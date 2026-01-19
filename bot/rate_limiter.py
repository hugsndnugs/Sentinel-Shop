"""
Global rate limiting system for Discord API calls.
Implements per-channel queuing, token bucket algorithm, and global rate limit tracking.
"""

import asyncio
import logging
import time
from collections import deque
from typing import Optional, Callable, Any, Dict, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class RateLimitType(Enum):
    """Types of rate limits"""

    CHANNEL_MESSAGE = "channel_message"  # Per-channel message sending (5 per 5s)
    GLOBAL = "global"  # Global API rate limit (50 per second)
    AUDIT_LOG = "audit_log"  # Audit log fetching (conservative: 2 per second)


@dataclass
class RateLimitBucket:
    """Token bucket for rate limiting"""

    tokens: float
    capacity: float
    refill_rate: float  # tokens per second
    last_refill: float

    def refill(self, now: float) -> float:
        """Refill tokens and return available tokens"""
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now
        return self.tokens

    def consume(self, tokens: float = 1.0) -> bool:
        """Try to consume tokens. Returns True if successful."""
        now = time.time()
        available = self.refill(now)
        if available >= tokens:
            self.tokens -= tokens
            return True
        return False

    def wait_time(self, tokens: float = 1.0) -> float:
        """Calculate how long to wait before tokens are available"""
        now = time.time()
        available = self.refill(now)
        if available >= tokens:
            return 0.0
        needed = tokens - available
        return needed / self.refill_rate


@dataclass
class QueuedItem:
    """Item in the rate limit queue"""

    coro: Callable
    args: tuple
    kwargs: dict
    future: Optional[asyncio.Future] = None
    timestamp: float = 0.0

    def __post_init__(self):
        if self.timestamp == 0.0:
            self.timestamp = time.time()


class RateLimiter:
    """
    Global rate limiter for Discord API calls.
    Implements per-channel queuing with token bucket algorithm.
    """

    def __init__(self):
        # Per-channel queues for message sending
        self._channel_queues: Dict[int, deque] = {}
        self._channel_locks: Dict[int, asyncio.Lock] = {}
        self._channel_buckets: Dict[int, RateLimitBucket] = {}
        self._processing_tasks: Dict[int, asyncio.Task] = {}

        # Global rate limit bucket
        self._global_bucket = RateLimitBucket(
            tokens=50.0,
            capacity=50.0,
            refill_rate=50.0,  # 50 tokens per second
            last_refill=time.time(),
        )
        self._global_lock = asyncio.Lock()

        # Audit log rate limiting
        self._audit_log_bucket = RateLimitBucket(
            tokens=2.0,
            capacity=2.0,
            refill_rate=2.0,  # Conservative: 2 per second
            last_refill=time.time(),
        )
        self._audit_log_lock = asyncio.Lock()

        # Configuration
        self._channel_rate_limit = 5.0  # 5 messages per 5 seconds per channel
        self._channel_window = 5.0
        self._send_spacing = 0.1  # 100ms spacing between sends in batches
        self._max_queue_size = 100  # Maximum items per queue
        self._enabled = True

        # Statistics
        self._stats = {
            "rate_limit_hits": 0,
            "messages_queued": 0,
            "messages_sent": 0,
            "queue_overflows": 0,
        }

    def configure(
        self,
        channel_rate_limit: Optional[float] = None,
        channel_window: Optional[float] = None,
        send_spacing: Optional[float] = None,
        max_queue_size: Optional[int] = None,
        enabled: Optional[bool] = None,
    ):
        """Update rate limiter configuration"""
        if channel_rate_limit is not None:
            self._channel_rate_limit = channel_rate_limit
        if channel_window is not None:
            self._channel_window = channel_window
        if send_spacing is not None:
            self._send_spacing = send_spacing
        if max_queue_size is not None:
            self._max_queue_size = max_queue_size
        if enabled is not None:
            self._enabled = enabled

    def get_stats(self) -> Dict[str, Any]:
        """Get rate limiter statistics"""
        queue_sizes = {
            ch_id: len(queue) for ch_id, queue in self._channel_queues.items()
        }
        return {
            **self._stats,
            "queue_sizes": queue_sizes,
            "active_channels": len(self._channel_queues),
        }

    def _get_channel_bucket(self, channel_id: int) -> RateLimitBucket:
        """Get or create rate limit bucket for a channel"""
        if channel_id not in self._channel_buckets:
            self._channel_buckets[channel_id] = RateLimitBucket(
                tokens=self._channel_rate_limit,
                capacity=self._channel_rate_limit,
                refill_rate=self._channel_rate_limit / self._channel_window,
                last_refill=time.time(),
            )
        return self._channel_buckets[channel_id]

    def _get_channel_lock(self, channel_id: int) -> asyncio.Lock:
        """Get or create lock for a channel"""
        if channel_id not in self._channel_locks:
            self._channel_locks[channel_id] = asyncio.Lock()
        return self._channel_locks[channel_id]

    def _get_channel_queue(self, channel_id: int) -> deque:
        """Get or create queue for a channel"""
        if channel_id not in self._channel_queues:
            self._channel_queues[channel_id] = deque(maxlen=self._max_queue_size)
        return self._channel_queues[channel_id]

    async def _process_channel_queue(self, channel_id: int):
        """Process items in a channel's queue"""
        queue = self._get_channel_queue(channel_id)
        lock = self._get_channel_lock(channel_id)
        bucket = self._get_channel_bucket(channel_id)

        while True:
            # Get next item from queue
            async with lock:
                if not queue:
                    # Queue is empty, stop processing
                    self._processing_tasks.pop(channel_id, None)
                    return

                item: QueuedItem = queue.popleft()

            # Wait for global rate limit
            async with self._global_lock:
                wait_time = self._global_bucket.wait_time()
                if wait_time > 0:
                    await asyncio.sleep(wait_time)
                self._global_bucket.consume()

            # Wait for channel rate limit
            wait_time = bucket.wait_time()
            if wait_time > 0:
                logger.debug(
                    f"Rate limit wait for channel {channel_id}: {wait_time:.2f}s"
                )
                await asyncio.sleep(wait_time)

            # Consume token and execute
            if bucket.consume():
                try:
                    result = await item.coro(*item.args, **item.kwargs)
                    if item.future and not item.future.done():
                        item.future.set_result(result)
                    self._stats["messages_sent"] += 1
                except Exception as e:
                    if item.future and not item.future.done():
                        item.future.set_exception(e)
                    logger.error(
                        f"Error executing queued item for channel {channel_id}: {e}"
                    )
                    # If it's a rate limit error, we might want to re-queue
                    # For now, just log and continue
            else:
                # Shouldn't happen after wait_time, but handle it
                logger.warning(
                    f"Failed to consume token for channel {channel_id} after waiting"
                )
                # Re-queue the item
                async with lock:
                    queue.appendleft(item)
                await asyncio.sleep(0.1)

    async def enqueue_send(
        self, channel_id: int, coro: Callable, *args, **kwargs
    ) -> asyncio.Future:
        """
        Enqueue a send operation for rate limiting.

        Args:
            channel_id: Discord channel ID
            coro: Coroutine function to execute
            *args, **kwargs: Arguments for the coroutine

        Returns:
            Future that will be resolved when the operation completes
        """
        if not self._enabled:
            # Rate limiting disabled, execute immediately
            return asyncio.create_task(coro(*args, **kwargs))

        future = asyncio.Future()
        item = QueuedItem(coro=coro, args=args, kwargs=kwargs, future=future)

        queue = self._get_channel_queue(channel_id)
        lock = self._get_channel_lock(channel_id)

        async with lock:
            if len(queue) >= self._max_queue_size:
                self._stats["queue_overflows"] += 1
                logger.warning(
                    f"Queue overflow for channel {channel_id}. "
                    f"Dropping message (queue size: {len(queue)})"
                )
                future.set_exception(ValueError("Rate limit queue overflow"))
                return future

            queue.append(item)
            self._stats["messages_queued"] += 1

        # Start processing task if not already running
        if channel_id not in self._processing_tasks:
            task = asyncio.create_task(self._process_channel_queue(channel_id))
            self._processing_tasks[channel_id] = task

        return future

    async def execute_with_audit_log_limit(self, coro: Callable, *args, **kwargs):
        """
        Execute a coroutine with audit log rate limiting.

        Args:
            coro: Coroutine function to execute (typically audit log fetch)
            *args, **kwargs: Arguments for the coroutine

        Returns:
            Result of the coroutine
        """
        if not self._enabled:
            return await coro(*args, **kwargs)

        async with self._audit_log_lock:
            wait_time = self._audit_log_bucket.wait_time()
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            if not self._audit_log_bucket.consume():
                # Wait and retry
                wait_time = self._audit_log_bucket.wait_time()
                if wait_time > 0:
                    await asyncio.sleep(wait_time)

            return await coro(*args, **kwargs)

    async def handle_rate_limit_response(
        self, channel_id: Optional[int], retry_after: float
    ):
        """
        Handle a rate limit response from Discord.
        Updates buckets and adjusts timing.

        Args:
            channel_id: Channel ID that was rate limited (None for global)
            retry_after: Seconds to wait before retrying
        """
        self._stats["rate_limit_hits"] += 1

        if channel_id is not None:
            bucket = self._get_channel_bucket(channel_id)
            # Reset bucket and wait
            bucket.tokens = 0
            bucket.last_refill = time.time() + retry_after
            logger.warning(
                f"Rate limited on channel {channel_id}. Retry after {retry_after}s"
            )
        else:
            # Global rate limit
            self._global_bucket.tokens = 0
            self._global_bucket.last_refill = time.time() + retry_after
            logger.warning(f"Global rate limit hit. Retry after {retry_after}s")

        await asyncio.sleep(retry_after)

    def get_channel_queue_size(self, channel_id: int) -> int:
        """Get current queue size for a channel"""
        queue = self._get_channel_queue(channel_id)
        return len(queue)

    async def shutdown(self):
        """Shutdown rate limiter and wait for all queues to process"""
        logger.info("Shutting down rate limiter...")
        # Cancel all processing tasks
        for task in self._processing_tasks.values():
            task.cancel()

        # Wait for tasks to complete
        if self._processing_tasks:
            await asyncio.gather(
                *self._processing_tasks.values(), return_exceptions=True
            )

        self._processing_tasks.clear()
        logger.info("Rate limiter shutdown complete")


# Global rate limiter instance
_rate_limiter_instance: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get the global rate limiter instance"""
    global _rate_limiter_instance
    if _rate_limiter_instance is None:
        _rate_limiter_instance = RateLimiter()
    return _rate_limiter_instance


def reset_rate_limiter():
    """Reset the global rate limiter (mainly for testing)"""
    global _rate_limiter_instance
    if _rate_limiter_instance:
        asyncio.create_task(_rate_limiter_instance.shutdown())
    _rate_limiter_instance = None

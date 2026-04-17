"""
Tests for the scheduler module (app/scheduler.py).

Tests cover:
- schedule_post_job (enqueue_in vs enqueue based on delay)
- cancel_scheduled_job
- remove_job
- load_and_reschedule_posts
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch


class TestSchedulePostJob:
    """Tests for schedule_post_job function."""

    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        """Set up mocks for all scheduler tests."""
        self.mock_queue = MagicMock()

        import importlib
        import app.scheduler
        importlib.reload(app.scheduler)
        self.scheduler = app.scheduler

        # Patch the module-level scheduler_queue directly
        self.queue_patcher = patch.object(self.scheduler, 'scheduler_queue', self.mock_queue)
        self.queue_patcher.start()

        yield

        self.queue_patcher.stop()

    @pytest.mark.asyncio
    async def test_schedules_future_post_with_enqueue_in(self):
        """Post with future schedule_time should use enqueue_in."""
        future_time = datetime.now() + timedelta(hours=1)

        await self.scheduler.schedule_post_job('post-123', future_time)

        self.mock_queue.enqueue_in.assert_called_once()
        call_args = self.mock_queue.enqueue_in.call_args
        delay = call_args[0][0]
        assert delay.total_seconds() > 0

    @pytest.mark.asyncio
    async def test_schedules_past_post_with_enqueue(self):
        """Post with past schedule_time should use enqueue immediately."""
        past_time = datetime.now() - timedelta(hours=1)

        await self.scheduler.schedule_post_job('post-456', past_time)

        self.mock_queue.enqueue.assert_called_once()

    @pytest.mark.asyncio
    async def test_schedules_now_post_with_enqueue(self):
        """Post with current time should use enqueue immediately."""
        now = datetime.now()

        await self.scheduler.schedule_post_job('post-now', now)

        self.mock_queue.enqueue.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_on_redis_connection_error(self):
        """Should raise exception when Redis connection fails."""
        from redis.exceptions import ConnectionError as RedisConnectionError
        self.mock_queue.enqueue_in.side_effect = RedisConnectionError("Connection refused")

        future_time = datetime.now() + timedelta(hours=1)

        with pytest.raises(RedisConnectionError):
            await self.scheduler.schedule_post_job('post-err', future_time)


class TestCancelScheduledJob:
    """Tests for cancel_scheduled_job function."""

    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        import importlib
        import app.scheduler
        importlib.reload(app.scheduler)
        self.scheduler = app.scheduler

        yield

    @pytest.mark.asyncio
    async def test_cancels_existing_job(self):
        """Should call job.cancel() for existing job."""
        mock_job = MagicMock()
        with patch('rq.job.Job') as MockJob:
            MockJob.fetch.return_value = mock_job

            await self.scheduler.cancel_scheduled_job('job-123')

            MockJob.fetch.assert_called_once()
            mock_job.cancel.assert_called_once()

    @pytest.mark.asyncio
    async def test_ignores_nonexistent_job(self):
        """Should silently ignore NoSuchJobError."""
        from rq.exceptions import NoSuchJobError
        with patch('rq.job.Job') as MockJob:
            MockJob.fetch.side_effect = NoSuchJobError

            await self.scheduler.cancel_scheduled_job('nonexistent')
            # Should not raise

    @pytest.mark.asyncio
    async def test_raises_on_redis_error(self):
        """Should raise on Redis connection error."""
        from redis.exceptions import ConnectionError as RedisConnectionError
        with patch('rq.job.Job') as MockJob:
            MockJob.fetch.side_effect = RedisConnectionError

            with pytest.raises(RedisConnectionError):
                await self.scheduler.cancel_scheduled_job('job-123')


class TestRemoveJob:
    """Tests for remove_job function."""

    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        import importlib
        import app.scheduler
        importlib.reload(app.scheduler)
        self.scheduler = app.scheduler

        yield

    @pytest.mark.asyncio
    async def test_removes_existing_job(self):
        """Should call job.delete() for existing job."""
        mock_job = MagicMock()
        with patch('rq.job.Job') as MockJob:
            MockJob.fetch.return_value = mock_job

            await self.scheduler.remove_job('job-123')

            MockJob.fetch.assert_called_once()
            mock_job.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_ignores_nonexistent_job(self):
        """Should silently ignore NoSuchJobError."""
        from rq.exceptions import NoSuchJobError
        with patch('rq.job.Job') as MockJob:
            MockJob.fetch.side_effect = NoSuchJobError

            await self.scheduler.remove_job('nonexistent')
            # Should not raise


class TestLoadAndReschedulePosts:
    """Tests for load_and_reschedule_posts function."""

    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        self.mock_queue = MagicMock()

        import importlib
        import app.scheduler
        importlib.reload(app.scheduler)
        self.scheduler = app.scheduler

        self.queue_patcher = patch.object(self.scheduler, 'scheduler_queue', self.mock_queue)
        self.queue_patcher.start()

        yield

        self.queue_patcher.stop()

    @pytest.mark.asyncio
    async def test_reschedules_pending_future_posts(self):
        """Should reschedule pending posts with future schedule_time."""
        mock_post = MagicMock()
        mock_post.id = 'post-1'
        mock_post.schedule_time = datetime.now() + timedelta(hours=1)
        mock_post.status = 'pending'

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_post]

        mock_session = MagicMock()
        mock_session.execute.return_value = mock_result

        mock_engine = MagicMock()
        mock_sessionmaker_cls = MagicMock(return_value=mock_session)

        with patch('sqlalchemy.create_engine', return_value=mock_engine), \
             patch('sqlalchemy.orm.sessionmaker', return_value=mock_sessionmaker_cls), \
             patch.object(self.scheduler, 'schedule_post_job') as mock_schedule:

            await self.scheduler.load_and_reschedule_posts()

            mock_schedule.assert_called_once()

    @pytest.mark.asyncio
    async def test_skips_past_posts(self):
        """Should not reschedule posts with past schedule_time."""
        mock_post = MagicMock()
        mock_post.id = 'post-old'
        mock_post.schedule_time = datetime.now() - timedelta(hours=1)
        mock_post.status = 'pending'

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_post]

        mock_session = MagicMock()
        mock_session.execute.return_value = mock_result

        mock_engine = MagicMock()
        mock_sessionmaker_cls = MagicMock(return_value=mock_session)

        with patch('sqlalchemy.create_engine', return_value=mock_engine), \
             patch('sqlalchemy.orm.sessionmaker', return_value=mock_sessionmaker_cls), \
             patch.object(self.scheduler, 'schedule_post_job') as mock_schedule:

            await self.scheduler.load_and_reschedule_posts()

            mock_schedule.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_non_pending_posts(self):
        """Should only query pending posts."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []

        mock_session = MagicMock()
        mock_session.execute.return_value = mock_result

        mock_engine = MagicMock()
        mock_sessionmaker_cls = MagicMock(return_value=mock_session)

        with patch('sqlalchemy.create_engine', return_value=mock_engine), \
             patch('sqlalchemy.orm.sessionmaker', return_value=mock_sessionmaker_cls), \
             patch.object(self.scheduler, 'schedule_post_job') as mock_schedule:

            await self.scheduler.load_and_reschedule_posts()

            # Verify query was executed
            mock_session.execute.assert_called_once()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

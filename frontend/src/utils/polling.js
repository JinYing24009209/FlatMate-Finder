// Poll visible conversations and refresh immediately when the user returns.
export function startPolling(
  refresh,
  {
    host = window,
    page = document,
    interval = 5000
  } = {}
) {
  let stopped = false;

  const tick = () => {
    if (!stopped && !page.hidden) {
      refresh();
    }
  };

  const timer = host.setInterval(tick, interval);

  host.addEventListener('focus', tick);
  page.addEventListener('visibilitychange', tick);

  return () => {
    stopped = true;
    host.clearInterval(timer);
    host.removeEventListener('focus', tick);
    page.removeEventListener('visibilitychange', tick);
  };
}
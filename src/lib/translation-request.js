export async function translationJson(url, options = {}, fetcher = fetch, timeoutMs = 12000) {
  const controller = new AbortController();
  const parent = options.signal;
  const abort = () => controller.abort(parent?.reason);
  if(parent?.aborted) abort();
  else parent?.addEventListener('abort', abort, {once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('Translation timed out','TimeoutError')),timeoutMs);
  try {
    const response=await fetcher(url,{...options,signal:controller.signal});
    const data=await response.json();
    return {ok:response.ok,status:response.status,data};
  } finally { clearTimeout(timer); parent?.removeEventListener('abort',abort); }
}

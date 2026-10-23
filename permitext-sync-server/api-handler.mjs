import {performance} from 'node:perf_hooks';

// Start measuring before importing the application. Static imports conceal the
// cold module initialization cost from all request-level Search timers.
export function createAPIHandler(loadApplication = () => import('./app.mjs')) {
  let application;
  return async function handler(request, response) {
    const started = performance.now();
    if (!application) {
      const pending = Promise.resolve().then(loadApplication).catch(error => {
        if (application === pending) application = null;
        throw error;
      });
      application = pending;
    }
    const {handleRequest} = await application;
    if (request.method === 'GET' && new URL(request.url, 'http://api.invalid').pathname === '/code/search') {
      const prior = response.getHeader('Server-Timing');
      response.setHeader('Server-Timing', `${prior ? `${prior}, ` : ''}app_load;dur=${(performance.now() - started).toFixed(2)}`);
    }
    await handleRequest(request, response);
  };
}

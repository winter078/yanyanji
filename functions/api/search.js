import { handleSearch } from '../_lib/search.js';

export async function onRequestPost(context) {
  return handleSearch(context);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS'
    }
  });
}

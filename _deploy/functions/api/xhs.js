// Public XHS proxy route. Deployment marker: 2026111316.
import { handleXhs, handleXhsOptions } from '../_lib/xhs.js';

export async function onRequestPost(context) {
  return handleXhs(context);
}

export async function onRequestOptions() {
  return handleXhsOptions();
}

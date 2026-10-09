/**
 * Normalizes a backend list response into a plain array.
 *
 * The API returns either a raw array or a PagedResult<T> shape
 * (`{ items: [...], totalCount, page, pageSize, ... }`) depending on the endpoint.
 * Every list-fetching hook previously repeated the same defensive check inline
 * (`Array.isArray(data) ? data : (data?.items ?? [])`) — this is the single
 * extracted version all of them now use.
 *
 * @param {unknown} data - Raw response body from a list endpoint.
 * @returns {Array} The list of items, or an empty array if none could be found.
 */
export function unwrapPaged(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

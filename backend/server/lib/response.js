export function ok(res, payload) {
  res.json(payload);
}

export function badRequest(res, message) {
  res.status(400).json({ error: message });
}

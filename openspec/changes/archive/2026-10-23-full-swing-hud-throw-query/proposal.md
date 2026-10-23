# Reuse the HUD throw query
HUD currently may scan throw targets twice in the same synchronous update: prompt selection and throwable button. Reuse one result per HUD update while preserving prompt priority, phone button availability and current hero orientation. No FPS claim.

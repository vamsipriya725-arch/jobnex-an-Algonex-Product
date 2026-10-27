export function renderErrorPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Error - JobNex</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; border: 1px solid #334155; padding: 2.5rem; border-radius: 1rem; max-width: 480px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; color: #f43f5e; }
    p { font-size: 0.875rem; color: #94a3b8; line-height: 1.5; margin-bottom: 1.5rem; }
    a { display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; }
    a:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Something went wrong</h1>
    <p>JobNex encountered an unexpected server error while processing this page. Please refresh or return to the home page.</p>
    <a href="/">Return to Home</a>
  </div>
</body>
</html>`;
}

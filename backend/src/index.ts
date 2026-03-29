import app from './app.js';
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🚀 Prophis API running on http://localhost:${PORT}\n`);
});

export default app;

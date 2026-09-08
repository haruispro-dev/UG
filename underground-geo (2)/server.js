const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname)));

// SPA-style fallback isn't needed (every page is a real .html file),
// but keep a 404 fallback tidy:
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`UNDERGROUND GEO running on port ${PORT}`));

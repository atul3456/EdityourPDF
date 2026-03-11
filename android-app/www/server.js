const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('.')); // Serve current directory files

app.listen(PORT, () => {
    console.log(`GlassyTools Server running on http://localhost:${PORT}`);
});

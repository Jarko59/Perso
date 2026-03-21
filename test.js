const { JSDOM } = require('jsdom');
try {
  const dom = new JSDOM(`<script>let x = 'Démarrer l\\\'instance'; console.log("HELLO", x);</script>`, { runScripts: 'dangerously' });
} catch (e) {
  console.log("ERROR IS:", e.message);
}

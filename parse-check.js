const parser = require('@babel/parser');
const fs = require('fs');
const path = require('path');

const files = [
  'src/i18n/LanguageContext.jsx',
  'src/i18n/LanguageToggle.jsx',
  'src/i18n/autoTranslate.js',
  'src/i18n/dictionary.js',
  'src/index.js',
  'src/App.js',
  'src/Components/Topbar/Topbar.jsx',
  'src/Components/Topbar/Sidemenu.jsx',
  'src/Components/Navbar/Navbar.jsx',
  'src/Pages/Signin.jsx',
  'src/Pages/Signup.jsx',
];

let bad = 0;
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  try {
    parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    console.log('OK   ', f);
  } catch (e) {
    bad++;
    console.log('FAIL ', f, '->', e.message);
  }
}
process.exit(bad ? 1 : 0);

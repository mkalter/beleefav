const express = require('express');
const bodyParser = require('body-parser');
const xlsx = require('xlsx');
const path = require('path');
const ejs = require('ejs');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const morgan = require('morgan');

const app = express();
const port = 3000;

// Middleware setup
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Add session middleware with a custom store (memory store in this case)
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  store: new MemoryStore({
    checkPeriod: 86400000,
  }),
  cookie: { maxAge: 1209600000 },
}));

// Path to the Excel file
const excelFilePath = path.join(__dirname, 'tv_data.xlsx');

// Read the Excel file at the start of the application
let tvData = readExcel();

// Function to read the Excel file
function readExcel() {
  try {
    const workbook = xlsx.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  } catch (error) {
    console.error('Error reading the Excel file:', error);
    return [];
  }
}

// Function to update the Excel file
function updateExcel(data) {
  try {
    const worksheet = xlsx.utils.json_to_sheet(data);
    const updatedWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(updatedWorkbook, worksheet, 'TvData');
    xlsx.writeFile(updatedWorkbook, excelFilePath);
  } catch (error) {
    console.error('Error updating the Excel file:', error);
  }
}

// Middleware to check if the user is authenticated as admin
function isAdminAuthenticated(req, res, next) {
  if (req.session.isAuthenticated && req.session.userRole === 'admin') {
    return next();
  }
  res.redirect('/login');
}

// Middleware to check if the user is authenticated with a specific role
function isUserAuthenticated(role) {
  return function (req, res, next) {
    if (req.session.isAuthenticated && req.session.userRole === role) {
      return next();
    }
    res.redirect('/login');
  };
}
// Middleware to check if the user is authenticated as 'Flynth'
function isFlynthAuthenticated(req, res, next) {
  if (req.session.isAuthenticated && req.session.userRole === 'Flynth') {
    return next();
  }
  res.redirect('/overzicht'); // Redirect 'Flynth' to the 'overzicht' page
}

// Route for the 'overzicht' page for 'Flynth'
app.get('/overzicht', isFlynthAuthenticated, (req, res) => {
  // 'Flynth'-specific logic for 'overzicht' page
  res.render('overzicht', { tvData }); // Pass tvData to the template
});

// Route for the login page
app.get('/login', (req, res) => {
  res.render('login', { errorMessage: '' });
});

// Route to handle login form submission
app.post('/login', (req, res) => {
  const { username, password, rememberMe } = req.body;

  // Add your authentication logic here (e.g., check username and password against a database)
  // For simplicity, I'll use a hardcoded check
  if (username === 'admin' && password === 'admin') {
    req.session.isAuthenticated = true;
    req.session.userRole = 'admin';

    if (rememberMe) {
      // If 'Remember Me' is checked, set the maxAge of the cookie to 30 days
      req.session.cookie.maxAge = 2592000000; // 30 days in milliseconds
    }

    res.render('index');
  } else if (username === 'BeleefAV' && password === 'password') {
    req.session.isAuthenticated = true;
    req.session.userRole = 'BeleefAV';
    res.render('index');
  } else if (username === 'Flynth' && password === 'password') {
    req.session.isAuthenticated = true;
    req.session.userRole = 'Flynth';
    res.redirect('/overzicht');
  } else {
    res.render('login', { errorMessage: 'Gebruikersnaam/wachtwoord ongeldig' });
  }
});

// Route for the TV-beheer page for admin
app.get('/tv-beheer', isAdminAuthenticated, (req, res) => {
  // Admin-specific logic here
  // ...
  const workbook = xlsx.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const tvData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  res.render('tv-beheer', { tvData });
});

// Route for the TV-beheer page for 'BeleefAV'
app.get('/tv-beheer-beleefav', isUserAuthenticated('BeleefAV'), (req, res) => {
  // 'BeleefAV'-specific logic here
  // ...
  const workbook = xlsx.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const tvData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  res.render('tv-beheer', { tvData });
});

// Route for the TV-beheer page for 'Flynth'
app.get('/tv-beheer-flynth', isUserAuthenticated('Flynth'), (req, res) => {
  // 'Flynth'-specific logic here
  // ...
  const workbook = xlsx.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const tvData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  res.render('tv-beheer', { tvData });
});

// Route to delete TV data
app.delete('/delete_tv/:id', isAdminAuthenticated, (req, res) => {
  const tvIdToDelete = req.params.id;

  // Filter out the selected TV from the data
  const updatedTvData = tvData.filter(tv => tv.ID !== tvIdToDelete);

  // Update the Excel file with the modified data
  updateExcel(updatedTvData);

  // Respond to the client
  res.json({ success: true });
});

// Route for the TV-toevoegen page
app.get('/tv-toevoegen', isAdminAuthenticated, (req, res) => {
  res.render('tv-toevoegen');
});

app.post('/add_tv', isAdminAuthenticated, (req, res) => {
  // Lees gegevens uit het formulier
  const merk = req.body.merk;
  const model = req.body.model;
  const barcode = req.body.barcode;
  const serienummer = req.body.serienummer;
  const schermFormaat = req.body.schermFormaat;
  const herkomst = req.body.herkomst;
  const staat = req.body.staat;
  const beschikbaarheid = req.body.beschikbaarheid;
  const opmerkingen = req.body.opmerkingen;

  // Nieuw: Lees gegevens voor locatie inzet uit het formulier
  const locatieInzet = req.body.locatieInzet;

  // Lees bestaande gegevens uit het Excel-bestand
  const workbook = xlsx.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const tvData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Voeg nieuwe tv-gegevens toe
  const newTv = {
    Merk: merk,
    Model: model,
    Barcode: barcode,
    Serienummer: serienummer,
    schermFormaat: schermFormaat,
    Herkomst: herkomst,
    Staat: staat,
    Beschikbaarheid: beschikbaarheid,
    Opmerkingen: opmerkingen,
    // Nieuw: Voeg locatie inzet toe aan de gegevens
    LocatieInzet: locatieInzet
  };

  tvData.push(newTv);

  // Schrijf gegevens terug naar het Excel-bestand
  const newWorkbook = xlsx.utils.book_new();
  const newWorksheet = xlsx.utils.json_to_sheet(tvData);
  xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
  xlsx.writeFile(newWorkbook, excelFilePath);

  res.redirect('/');
});

// Route for the TV-kiezen page
app.get('/tv-kiezen', isAdminAuthenticated, (req, res) => {
  // Read data from Excel file
  const workbook = xlsx.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  let tvData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Filter only available TVs
  tvData = tvData.filter(tv => tv.Beschikbaarheid === 'Ja');

  res.render('tv-kiezen', { tvData });
});

// Route for choosing a TV
app.post('/choose_tv', isAdminAuthenticated, (req, res) => {
  // Lees het Excel-bestand bij het starten van de route
  const tvData = readExcel();

  const selectedTvValue = req.body.tvSelection;
  const manuallyEnteredLocatieInzet = req.body.locatieInzet; // Haal handmatig ingevoerde locatie op

  // Zoek de geselecteerde TV in de gegevens
  const selectedTvIndex = tvData.findIndex(tv => {
    const tvValue = `${tv.Merk} - ${tv.Model} - ${tv['Scherm Formaat']} inch - ${tv.Barcode}`;
    return tvValue === selectedTvValue;
  });

  if (selectedTvIndex !== -1) {
    // Update de beschikbaarheid van de geselecteerde TV naar 'Nee'
    tvData[selectedTvIndex].Beschikbaarheid = 'Nee';

    // Update de locatiegegevens van de geselecteerde TV met handmatig ingevoerde locatie
    tvData[selectedTvIndex].LocatieInzet = manuallyEnteredLocatieInzet;

    // Update het Excel-bestand met de gewijzigde gegevens
    updateExcel(tvData);

    // Redirect naar de homepagina of een andere gewenste pagina
    res.redirect('/');
  } else {
    // Handel het geval af waarin de geselecteerde TV niet wordt gevonden
    res.status(404).send('Geselecteerde TV niet gevonden');
  }
});

// Route for the 'overzicht' page for 'Flynth'
app.get('/overzicht', isFlynthAuthenticated, (req, res) => {
  // 'Flynth'-specific logic for 'overzicht' page
  res.render('overzicht', { tvData }); // Pass tvData to the template
});

// Set up views and static files
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Redirect '/' to the login page if not authenticated; otherwise, redirect to the 'index' page
app.get('/', (req, res) => {
  if (req.session.isAuthenticated) {
    // User is authenticated, redirect to 'index'
    res.render('index', { tvData });
  } else {
    // User is not authenticated, redirect to 'login'
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
        } else {
            res.redirect('/login');
        }
    });
});

// Voeg dit toe aan je Express-app-bestand
app.get('/account-beheer', (req, res) => {
    res.render('account-beheer'); // Vervang 'account-beheer' met de naam van je EJS-bestand
});

// Voeg dit toe aan je Express-app-bestand
app.post('/account-beheer', (req, res) => {
    // Verwerk hier de formuliergegevens, bijvoorbeeld door ze op te slaan in de database
    const { username, password, email } = req.body;

    // Voeg hier de logica toe voor het opslaan van gegevens in de database of waar nodig

    // Stuur een reactie terug naar de client, bijvoorbeeld een bevestigingspagina
    res.render('account-beheer-bevestiging', { username, email });
});

// Route om celwijzigingen te verwerken
app.post('/update_cell', isAdminAuthenticated, (req, res) => {
    const { row, column, value } = req.body;

    // Lees het Excel-bestand
    let tvData = readExcel();

    // Update de specifieke celwaarde
    if (row >= 0 && row < tvData.length) {
        const keys = Object.keys(tvData[0]);
        if (column >= 0 && column < keys.length) {
            const key = keys[column];
            tvData[row][key] = value;
            
            // Update het Excel-bestand
            updateExcel(tvData);

            res.json({ success: true, message: "Cel succesvol bijgewerkt" });
        } else {
            res.status(400).json({ error: 'Ongeldige kolomindex' });
        }
    } else {
        res.status(400).json({ error: 'Ongeldige rijindex' });
    }
});

// Start de server
app.listen(port, () => {
  console.log(`Server gestart op http://localhost:${port}`);
});

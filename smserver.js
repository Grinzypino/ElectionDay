const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8000;

// MongoDB connection URI
const MONGODB_URI = 'mongodb+srv://electionbackend:ePwDnqXF3GNzmwCc@election.ptaluj8.mongodb.net/?retryWrites=true&w=majority&appName=election';

// Defined a schema for polling station data
const psSchema = new mongoose.Schema({
  acPS: String,
  numPS: String,
  namePSh: String,
  latPS: Number,
  longPS: Number
});

// Created Mongoose model from the schema
const ac384ps = mongoose.model('ac384ps', psSchema);
const ac385ps = mongoose.model('ac385ps', psSchema);
const ac386ps = mongoose.model('ac386ps', psSchema);
const ac387ps = mongoose.model('ac387ps', psSchema);
const ac388ps = mongoose.model('ac388ps', psSchema);
const ac389ps = mongoose.model('ac389ps', psSchema);
const ac390ps = mongoose.model('ac390ps', psSchema);
const ac391ps = mongoose.model('ac391ps', psSchema);

// Defined a schema for officer data
const officerSchema = new mongoose.Schema({
  officerNum: String,
  current_location: String,
  before30mins_location: String,
  earlier_locations: Array,
  isTime: Number,
  ps_location: String
});

// Create a Mongoose model from the schema
const Officer = mongoose.model('officerLocations', officerSchema);

//function to calculate distance between two geolocations
function calculateDistance(location1, location2) {
  var coordinates1 = location1.split(',');
  var latlng1 = [parseFloat(coordinates1[0]), parseFloat(coordinates1[1])];
  var coordinates2 = location2.split(',');
  var latlng2 = [parseFloat(coordinates2[0]), parseFloat(coordinates2[1])];

  var R = 6371e3; // Radius of the earth in meters
  var lat1 = latlng1[0] * Math.PI/180; // Convert degrees to radians
  var lat2 = latlng2[0] * Math.PI/180;
  var deltaLat = (latlng2[0]-latlng1[0]) * Math.PI/180;
  var deltaLon = (latlng2[1]-latlng1[1]) * Math.PI/180;

  var a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
          Math.cos(lat1) * Math.cos(lat2) *
          Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  var distance = R * c; // Distance in meters
  return distance;
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
  });

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

app.post('/updateValues', (req, res) => {
      const officerData = req.body;
      
      console.log('Received officer data:', officerData);

      // Ensure officerNum and current_location are strings
      const roleValue= String(officerData.roleValue);
      const acValue= String(officerData.acValue);
      const psValue= String(officerData.psValue);
      const snoValue= String(officerData.snoValue);
      const znoValue= String(officerData.znoValue);
      const current_location = String(officerData.current_location.coordinates);
      const ps_location = String(officerData.ps_location.coordinates);
      // const officerNum = roleValue + acValue + psValue + snoValue + znoValue;

      // Find the existing officer document for the selected officer
      
      { 
        var officerNum = "";
        if(roleValue === '2'){
          officerNum = roleValue + acValue + snoValue;
        }
        else if(roleValue === '3'){
          officerNum = roleValue + acValue + znoValue;
        }
        else if(roleValue === '1'){
          officerNum = roleValue + acValue + psValue;
        }
       Officer.findOne({ officerNum: officerNum })
        .then((existingOfficer) => {
          if (existingOfficer) {
            // Update the existing document 
            console.log(existingOfficer.current_location);
            existingOfficer.current_location = current_location;
            
            if(roleValue === '1'){
              var PSdistance = calculateDistance(ps_location, current_location);
              if (PSdistance > 500){
                if(existingOfficer.isTime == 30){
                  existingOfficer.earlier_locations.push(current_location);
                  existingOfficer.before30mins_location = existingOfficer.earlier_locations.splice(0, 1)[0];
                }else{
                  existingOfficer.isTime += 5;
                  existingOfficer.earlier_locations.push(current_location);
                  existingOfficer.before30mins_location = existingOfficer.earlier_locations[0];
                }
              }
            }else if(existingOfficer.isTime == 30){
              existingOfficer.earlier_locations.push(current_location);
              existingOfficer.before30mins_location = existingOfficer.earlier_locations.splice(0, 1)[0];
            }else{
              existingOfficer.isTime += 5;
              existingOfficer.earlier_locations.push(current_location);
              existingOfficer.before30mins_location = existingOfficer.earlier_locations[0];
            }
             return existingOfficer.save()
              .then(() => {
                console.log('current location data updated');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Location data updated');
              });
          } else {
            // No existing document found, create a new one
            const newOfficer = new Officer({
              officerNum: officerNum,
              current_location: current_location,
              before30mins_location: current_location,
              earlier_locations: [current_location],
              isTime: 0,
              ps_location: ps_location
            });
            return newOfficer.save();
          }
        })
        .catch((err) => {
          console.error('Error updating location data:', err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        });
      }
});

// Serve HTML files with error handling
const serveHtmlFile = (filePath, res) => {
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error(`Error serving file ${filePath}:`, err);
      res.status(500).send('Internal Server Error');
    }
  });
};

app.get('/', (req, res) => {
  serveHtmlFile(path.join(__dirname, 'public', 'masterindex.html'), res);
});

app.get('/smdashboard', (req, res) => {
  serveHtmlFile(path.join(__dirname, 'public', 'smdashboard.html'), res);
});


// Fetch all officers data
app.get('/smdashboard2', (req, res) => {
  Officer.find({})
    .then((allofficers) => {
      res.status(200).json(allofficers);
    })
    .catch((err) => {
      console.error('Error fetching all officers data:', err);
      res.status(500).send('Internal Server Error');
    });
});

// Fetch all documents for each AC
const fetchAllPSDocuments = (model, res) => {
  model.find({})
    .then((allps) => {
      res.status(200).json(allps);
    })
    .catch((err) => {
      console.error(`Error fetching all ps of model ${model.modelName}:`, err);
      res.status(500).send('Internal Server Error');
    });
};

app.get('/ac384ps', (req, res) => {
  fetchAllPSDocuments(ac384ps, res);
});

app.get('/ac385ps', (req, res) => {
  fetchAllPSDocuments(ac385ps, res);
});

app.get('/ac386ps', (req, res) => {
  fetchAllPSDocuments(ac386ps, res);
});

app.get('/ac387ps', (req, res) => {
  fetchAllPSDocuments(ac387ps, res);
});

app.get('/ac388ps', (req, res) => {
  fetchAllPSDocuments(ac388ps, res);
});

app.get('/ac389ps', (req, res) => {
  fetchAllPSDocuments(ac389ps, res);
});

app.get('/ac390ps', (req, res) => {
  fetchAllPSDocuments(ac390ps, res);
});

app.get('/ac391ps', (req, res) => {
  fetchAllPSDocuments(ac391ps, res);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const credentials = require('./credentials.json');

// Define the Google API key as a global variable
const GOOGLE_API_KEY = 'AIzaSyAS72566eF3MF9HZ3HhUq4tuflB-0iJibE';

exports.handler = async (event, context) => {
    try {
        const { firstName, lastName, email, address } = event.queryStringParameters;
        
        // Retrieve latitude and longitude using Google Geocoding API
        const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
        const geocodingResponse = await axios.get(geocodingUrl);
        const location = geocodingResponse.data.results[0].geometry.location;
        const { lat, lng } = location;
        
        // Generate the static map URL using the obtained latitude and longitude
        const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=21&size=576x576&maptype=satellite&key=${GOOGLE_API_KEY}`;
        
        // Fetch weather data from drroof.com
        const url = `https://www.drroof.com/ws/retrieve-weather-results?address=${encodeURIComponent(address)}`;
        const response = await axios.post(url, {
                                          headers: {
                                          'Content-Type': 'application/x-www-form-urlencoded',
                                          Cookie:
                                          'ARRAffinity=ebe2790d749702022a54ce9bf5ef49208f8970a38b82360408bfec3955380433; ARRAffinitySameSite=ebe2790d749702022a54ce9bf5ef49208f8970a38b82360408bfec3955380433',
                                          },
                                          });
        
        const $ = cheerio.load(response.data);

        const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://footprints.roofr.com/footprint/${lat}/${lng}`,
        headers: {},
        };
        
        const footprintResponse = await axios(config);
        const { centroid, sqft, geojson, distance } = footprintResponse.data.data[0];
        
        const property = $('.loaded-weather-section p:nth-child(1)')
        .text()
        .replace('PROPERTY:', '')
        .trim();
        const historyText = $('.loaded-weather-section p:nth-child(2)').text().trim();
        const historyCountMatch = historyText.match(/\d+/);
        const historyCount = historyCountMatch ? parseInt(historyCountMatch[0]) : null;
        const riskFactor = $('.loaded-weather-section p:nth-child(3)')
        .text()
        .replace('CURRENT RISK FACTOR:', '')
        .trim();
        const riskLevel = parseFloat($('.loaded-weather-section .tick-arrow').css('left'));
        const events = {};
        
        $('.results-list .item').each((index, element) => {
                                      const date = $(element).find('.media-left b').text().trim();
                                      const weatherType = $(element).find('.media-body .bold').text().trim();
                                      const magnitude = $(element).find('.media-body').contents().last().text().trim();
                                      let icon = '';
                                      
                                      if (weatherType === 'Hail') {
                                      icon = 'https://severe-weather.netlify.app/functions/icons/icon-hail.png';
                                      } else if (weatherType === 'Wind') {
                                      icon = 'https://severe-weather.netlify.app/functions/icons/icon-wind.png';
                                      }
                                      
                                      events[`event.date ${index + 1}`] = date;
                                      events[`event.weatherType ${index + 1}`] = weatherType;
                                      events[`event.magnitude ${index + 1}`] = magnitude;
                                      events[`event.icon ${index + 1}`] = icon;
                                      });
        
        const result = {
        firstName: firstName,
        lastName: lastName,
        email: email,
        Property: property,
        historyCount: historyCount,
        riskFactor: riskFactor,
        riskLevel: riskLevel,
        staticMapUrl: staticMapUrl,
            ...events,
        Centroid: centroid,
        Sqft: sqft,
        Geojson: geojson,
        Distance: distance,
        };
        
        
        // Authenticate with the Google API using the credentials file
        const doc = new GoogleSpreadsheet('1eDLdYACz7brMWnasJD_LeDEjccQbzicfWZTdPbvIk7c');
        await doc.useServiceAccountAuth(credentials);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // Assuming you want to write to the first sheet
        const rows = await sheet.getRows();
        await sheet.addRow(result);
        
        return {
        statusCode: 200,
        body: JSON.stringify(result),
        };
    } catch (error) {
        console.log(error);
        return {
        statusCode: 500,
        body: JSON.stringify({ error: 'An error occurred' }),
        };
    }
};


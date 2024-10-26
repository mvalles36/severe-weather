const axios = require('axios');
const cheerio = require('cheerio');

exports.handler = async (event, context) => {
    try {
        const { address } = event.queryStringParameters;
        const lat = event.queryStringParameters.lat;
        const lng = event.queryStringParameters.lng;

        // Fetch weather data from drroof.com
        const weatherUrl = `https://www.drroof.com/ws/retrieve-weather-results?address=${encodeURIComponent(address)}`;
        const weatherResponse = await axios.post(weatherUrl, null, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Cookie: 'ARRAffinity=ebe2790d749702022a54ce9bf5ef49208f8970a38b82360408bfec3955380433; ARRAffinitySameSite=ebe2790d749702022a54ce9bf5ef49208f8970a38b82360408bfec3955380433',
            },
        });

        const $ = cheerio.load(weatherResponse.data);

        // Fetch roof footprint data
        const footprintUrl = `https://footprints.roofr.com/footprint/${lat}/${lng}`;
        const footprintResponse = await axios.get(footprintUrl);
        const { centroid, sqft, geojson, distance } = footprintResponse.data.data[0];

        // Parse weather data
        const property = $('.loaded-weather-section p:nth-child(1)').text().replace('PROPERTY:', '').trim();
        const historyText = $('.loaded-weather-section p:nth-child(2)').text().trim();
        const historyCount = historyText.match(/\d+/) ? parseInt(historyText.match(/\d+/)[0]) : null;
        const riskFactor = $('.loaded-weather-section p:nth-child(3)').text().replace('CURRENT RISK FACTOR:', '').trim();
        const riskLevel = parseFloat($('.loaded-weather-section .tick-arrow').css('left'));

        // Parse weather events
        const events = {};
        $('.results-list .item').each((index, element) => {
            const date = $(element).find('.media-left b').text().trim();
            const weatherType = $(element).find('.media-body .bold').text().trim();
            const magnitude = $(element).find('.media-body').contents().last().text().trim();
            
            let icon = '';
            switch(weatherType.toLowerCase()) {
                case 'hail':
                    icon = 'https://severe-weather.netlify.app/netlify/functions/icons/hail.png';
                    break;
                case 'wind':
                    icon = 'https://severe-weather.netlify.app/netlify/functions/icons/wind.png';
                    break;
                // Add more weather types as needed
            }
            
            events[`event.date${index + 1}`] = date;
            events[`event.weatherType${index + 1}`] = weatherType;
            events[`event.magnitude${index + 1}`] = magnitude;
            events[`event.icon${index + 1}`] = icon;
        });

        const result = {
            address,
            property,
            historyCount,
            riskFactor,
            riskLevel,
            Centroid: JSON.stringify(centroid),
            Sqft: sqft,
            Geojson: JSON.stringify(geojson),
            Distance: distance,
            ...events
        };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(result)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: 'An error occurred while fetching weather data',
                message: error.message 
            })
        };
    }
};

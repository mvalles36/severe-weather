const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('querystring');

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

    // Handle form-urlencoded data (e.g., sent from HTML forms)
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    let address, lat, lng;

    if (contentType.includes('application/json')) {
      const body = JSON.parse(event.body);
      address = body.address;
      lat = body.lat;
      lng = body.lng;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const parsed = qs.parse(event.body);
      address = parsed.address;
      lat = parsed.lat;
      lng = parsed.lng;
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unsupported content type' }),
      };
    }

    // 🛰️ Get weather history from DrRoof
    const weatherUrl = `https://www.drroof.com/ws/retrieve-weather-results?address=${encodeURIComponent(address)}`;
    const weatherResponse = await axios.post(weatherUrl, null, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': 'ARRAffinity=somevalue; ARRAffinitySameSite=somevalue',
      },
    });

    const $ = cheerio.load(weatherResponse.data);

    // 🧠 Parse weather risk & history
    const property = $('.loaded-weather-section p:nth-child(1)').text().replace('PROPERTY:', '').trim();
    const historyText = $('.loaded-weather-section p:nth-child(2)').text().trim();
    const historyCount = historyText.match(/\d+/) ? parseInt(historyText.match(/\d+/)[0]) : 0;
    const riskFactor = $('.loaded-weather-section p:nth-child(3)').text().replace('CURRENT RISK FACTOR:', '').trim();
    const riskLevel = parseFloat($('.loaded-weather-section .tick-arrow').css('left')) || 0;

    // ☁️ Parse weather events
    const events = [];
    $('.results-list .item').each((index, element) => {
      const date = $(element).find('.media-left b').text().trim();
      const weatherType = $(element).find('.media-body .bold').text().trim();
      const magnitude = $(element).find('.media-body').contents().last().text().trim();
      events.push({ date, weatherType, magnitude });
    });

    // 🧱 Fetch roof footprint from Roofr
    const footprintUrl = `https://footprints.roofr.com/footprint/${lat}/${lng}`;
    const footprintResponse = await axios.get(footprintUrl);
    const footprintData = footprintResponse.data.data?.[0] || {};

    const result = {
      address,
      property,
      historyCount,
      riskFactor,
      riskLevel,
      Centroid: JSON.stringify(footprintData.centroid || {}),
      Sqft: footprintData.sqft || null,
      Geojson: JSON.stringify(footprintData.geojson || {}),
      Distance: footprintData.distance || null,
      events,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'An error occurred while fetching weather data',
        message: error.message,
      }),
    };
  }
};

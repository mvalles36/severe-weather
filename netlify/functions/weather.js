const axios = require('axios');
const cheerio = require('cheerio');

exports.handler = async (event) => {
  try {
    // Allow only POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

    // Parse request body
    const { address, lat, lng } = JSON.parse(event.body);

    if (!address || !lat || !lng) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Weather data from drroof
    const weatherUrl = `https://www.drroof.com/ws/retrieve-weather-results?address=${encodeURIComponent(address)}`;
    const weatherResponse = await axios.post(weatherUrl, null, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: 'ARRAffinity=ebe2790d749702022a54ce9bf5ef49208f8970a38b82360408bfec3955380433; ARRAffinitySameSite=ebe2790d749702022a54ce9bf5ef49208f8970a38b82360408bfec3955380433',
      },
    });

    const $ = cheerio.load(weatherResponse.data);

    const property = $('.loaded-weather-section p:nth-child(1)').text().replace('PROPERTY:', '').trim();
    const historyText = $('.loaded-weather-section p:nth-child(2)').text().trim();
    const historyCount = historyText.match(/\d+/) ? parseInt(historyText.match(/\d+/)[0]) : null;
    const riskFactor = $('.loaded-weather-section p:nth-child(3)').text().replace('CURRENT RISK FACTOR:', '').trim();
    const riskLevel = parseFloat($('.loaded-weather-section .tick-arrow').css('left'));

    // Weather events
    const events = [];
    $('.results-list .item').each((index, element) => {
      const date = $(element).find('.media-left b').text().trim();
      const weatherType = $(element).find('.media-body .bold').text().trim();
      const magnitude = $(element).find('.media-body').contents().last().text().trim();
      events.push({ date, weatherType, magnitude });
    });

    // Roof footprint from roofr
    const footprintUrl = `https://footprints.roofr.com/footprint/${lat}/${lng}`;
    const footprintResponse = await axios.get(footprintUrl);
    const { centroid, sqft, geojson, distance } = footprintResponse.data.data[0];

    // Final response
    const result = {
      address,
      property,
      historyCount,
      riskFactor,
      riskLevel,
      roofArea: sqft,
      roofDimensions: {
        length: Math.sqrt(sqft),
        width: Math.sqrt(sqft),
      },
      Centroid: JSON.stringify(centroid),
      Geojson: JSON.stringify(geojson),
      Distance: distance,
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
    console.error('Weather function error:', error.message);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Something went wrong', message: error.message }),
    };
  }
};

const axios = require('axios');
const qs = require('qs');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

exports.handler = function (event, context, callback) {
  const address = event.queryStringParameters.address || '';

  const data = qs.stringify({
    address: address
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://www.drroof.com/ws/retrieve-weather-results',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': 'ARRAffinity=ebe2790d749702022a54ce9bf5ef49208f8970a38b82360408bfec3955380433; ARRAffinitySameSite=ebe2790d749702022a54ce9bf5ef49208f8970a38b82360408bfec3955380433',
      'Accept': 'text/html; charset=utf-8'
    },
    data: data
  };

  axios(config)
    .then(function (response) {
      const html = response.data;
      const $ = cheerio.load(html);

      const property = $('div.loaded-weather-section p:nth-child(1)').text().replace('PROPERTY: ', '');
      const history = $('div.loaded-weather-section p:nth-child(2)').text().replace('HISTORY: ', '');
      const riskFactor = $('div.loaded-weather-section p:nth-child(3)').text().replace('CURRENT RISK FACTOR: ', '');

      const riskBar = $('div.risk-bar');
      const tickArrowLeft = parseFloat(riskBar.find('div.tick-arrow').css('left'));
      const riskLevel = tickArrowLeft * 100;

      const detailedWeatherEvents = [];
      $('div.results-list div.item').each(function (index) {
        const date = $(this).find('div.media-left b').text();
        const type = $(this).find('div.media-body div.bold').text();
        const magnitude = $(this).find('div.media-body').contents().last().text().trim();

        let iconURL;
        if (type === 'Hail') {
          iconURL = 'https://severe-weather.netlify.app/functions/icons/icon-hail.png';
        } else if (type === 'Wind') {
          iconURL = 'https://severe-weather.netlify.app/functions/icons/icon-wind.png';
        } else {
          iconURL = 'https://example.com/default-icon.png'; // Default icon URL
        }

        const weatherEvent = {
          date: date,
          type: type,
          magnitude: magnitude,
          icon: {
            url: iconURL
          }
        };

        // Create unique reference headers
        const referenceHeaders = {
          date: `date${index + 1}`,
          type: `type${index + 1}`,
          magnitude: `magnitude${index + 1}`,
          icon: `icon${index + 1}`
        };

        // Map weatherEvent and referenceHeaders together
        const detailedWeatherEvent = Object.assign({}, weatherEvent, referenceHeaders);
        detailedWeatherEvents.push(detailedWeatherEvent);
      });

      const report = {
        property: property,
        history: history,
        riskFactor: riskFactor,
        riskLevel: riskLevel,
        detailedWeatherEvents: detailedWeatherEvents
      };

      const responseObject = {
        statusCode: 200,
        body: JSON.stringify(report),
        headers: {
          'Content-Type': 'application/json'
        }
      };

      return callback(null, responseObject);
    })
    .catch(function (error) {
      const errorResponse = {
        statusCode: 500,
        body: JSON.stringify({ error: 'An error occurred' }),
        headers: {
          'Content-Type': 'application/json'
        }
      };

      return callback(null, errorResponse);
    });
};

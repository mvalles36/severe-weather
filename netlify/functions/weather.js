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
          $('div.results-list div.item').each(function () {
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
                                              'Date': date,
                                              'Type': type,
                                              'Magnitude': magnitude,
                                              'Icon': iconURL
                                              };
                                              
                                              detailedWeatherEvents.push(weatherEvent);
                                              });
          
          const flattenedWeatherEvents = detailedWeatherEvents.flatMap((event, index) => {
                                                                       const flattenedEvent = {};
                                                                       for (const key in event) {
                                                                       flattenedEvent[`${key}${index + 1}`] = event[key];
                                                                       }
                                                                       return flattenedEvent;
                                                                       });
          
          const report = {
          'Property': property,
          'History': history,
          'RiskFactor': riskFactor,
          'RiskLevel': riskLevel,
          ...flattenedWeatherEvents[0] // Assume at least one weather event exists
          };
          
          const headers = Object.keys(report);
          
          const rows = [headers];
          rows.push(Object.values(report));
          flattenedWeatherEvents.forEach(event => {
                                         rows.push(Object.values(event));
                                         });
          
          const responseObject = {
          statusCode: 200,
          body: JSON.stringify(rows),
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


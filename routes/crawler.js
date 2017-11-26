let express = require('express');
let router = express.Router();
let request = require('request');
var rp = require('request-promise');
let cheerio = require('cheerio');
let colors = require('colors');
var perfy = require('perfy');
var logger = require('./logger');

const ROOT_URL = 'http://www.lacentrale.fr';
const DEFAULT_MAX_RESULTS = 30;
const DEFAULT_BRAND = 'SKODA';

let getCar = function(id) {
  perfy.start(`request-${id}`);  
  
  return rp(getCarParams(id))
    .then(function(body) {
      let elapsed = perfy.end(`request-${id}`);  
      logger.info(`car ${id} fetched in ${elapsed.time}ms`.green);
      let result = getCarFromResponse(body, id);

      return new Promise(function(resolve) { 
          resolve(result);
      });
    })
    .catch(function () {
      logger.error('car could not be fetched'.red);
    });  
}

let getCars = function(params) {
  perfy.start('request');

  return rp(getSearchParams(params))
    .then(function(body) {
      logger.info('search OK'.green);
      let result = getResultsFromResponse(body);

      return new Promise(function(resolve) { 
          resolve(result);
      });
    })
    .catch(function () {
      logger.error('search KO'.red);
    });   
}

let getCarFromResponse = function(body, id) {

  const $ = cheerio.load(body);

  var brand = $('h1.iophfzp')[0].children[1].firstChild.data.trim().replace(/\s\s.+/g, '');

  var name = '';

  $('h1.iophfzp').children().each(function() {
    name += $(this).text().trim().replace(/\s\s+/g, ' ');
    name += ' ';
  });

  name = name.trim();

  return {
    id : id,
    url : getCarParams(id).url,
    brand : brand,
    name : name,
    price : getNumericField($, $('div.gpfzj.sizeD'), 'strong', '€')
  }

}

let getResultsFromResponse = function(body) {
      const $ = cheerio.load(body);

      const cars = $('a.ann');
      let foundCars = [];

      for (let i = 0; i < cars.length; i++) {
        let car = cars[i];
        let foundCar = {};
        
        foundCar.url = getCarUrl(car.attribs['href']);
        foundCar.id = foundCar.url.match(/[0-9]+/)[0];
        foundCar.brand = getCarBrand($, $(car));
        foundCar.name = getCarName($, $(car));
        foundCar.imageUrl = getCarImageUrl($, $(car));
        foundCar.location = getNumericField($, $(car), '.dptCont', 'Dpt.');
        foundCar.year = getNumericField($, $(car), '.fieldYear');
        foundCar.mileage = getNumericField($, $(car), '.fieldMileage', 'km');
        foundCar.price = getNumericField($, $(car), '.fieldPrice', '€');

        foundCars.push(foundCar);
      }

      const minPrice = Math.min(...foundCars.map(car => car.price));
      const maxPrice = Math.max(...foundCars.map(car => car.price));

      let cheapCars = foundCars.filter(car => car.price === minPrice);
      let expensiveCars = foundCars.filter(car => car.price === maxPrice);

      return {
        infos : {
          results : foundCars.length,
          maxPrice : maxPrice,
          minPrice : minPrice,
          cheapest : cheapCars,
          mostExpensive : expensiveCars
        },
        cars : foundCars
      };
}

let getNumericField = function($, subNode, selector, patternToRemove) {
  let fieldValue = subNode.find($(selector)).first().text();
  if(patternToRemove) {
    fieldValue = fieldValue.replace(patternToRemove, '');
  }

  return parseInt(fieldValue.replace(/\s/g, ""), 10);
}

let getCarName = function($, carNode) {
  let name = '';

  carNode.find($('h3 span')).each(function() {
    let text = $(this).text();
    name += text.trim();
    name += ' ';
  });

  return name.trim();
}

let getCarBrand = function($, carNode) {
  return carNode.find($('h3 span')).first().text().trim();
}

let getCarUrl = function(endOfUrl) {
  return `${ROOT_URL}${endOfUrl}`;
}

let getCarImageUrl = function($, carNode) {
  let imageUrl = carNode.find($('.imgContent>img')).first().attr('src')
  return imageUrl.replace('-minivign', '');
}

let getCarParams = function(id) {
  return {
    url: `${ROOT_URL}/auto-occasion-annonce-${id}.html`
  }
}

let getSearchParams = function(params) {
  let brand = params.brand;
  let model = params.model;
  let maxResults = params.maxResults;
  let region = params.region;

  if(!maxResults) {
    maxResults = DEFAULT_MAX_RESULTS;
  }
  if(!brand) {
    brand = DEFAULT_BRAND;
  }
  if(!model) {
    model = '';
  }
  if (!region || region === 'all') {
    region = 'FR'
  }

  return {
    url: `${ROOT_URL}/listing_auto.php?marque=${brand}&modele=${model}&region=${region}`,
    headers: {
      'Cookie': 'NAPP=' + maxResults
    },
    jar: true
  }

}

module.exports = {
  getCar: getCar,
  getCars: getCars,
  getCarFromResponse: getCarFromResponse,
  getResultsFromResponse: getResultsFromResponse,
  getNumericField: getNumericField,
  getCarName: getCarName,
  getCarBrand: getCarBrand,
  getCarUrl: getCarUrl,
  getCarImageUrl: getCarImageUrl,
  getCarParams: getCarParams,
  getSearchParams: getSearchParams
}
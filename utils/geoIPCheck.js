const geoip = require('geoip-lite');
const config = require('../config.json');

function isRegionBlocked(ip) {
  const geo = geoip.lookup(ip);
  if (!geo) return false;

  const { country } = geo;
  return config.loadBalancer.blockedRegions.includes(country);
}

module.exports = { isRegionBlocked };

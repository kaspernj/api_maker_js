console.log("api-maker index.js loaded! KASPER")

// Normal classes
module.exports.BaseModel = require("./src/base-model").default
module.exports.Collection = require("./src/collection").default
module.exports.Result = require("./src/result").default

// Components
module.exports.Paginate = require("./src/components/paginate").default
module.exports.SortLink = require("./src/components/sort-link").default

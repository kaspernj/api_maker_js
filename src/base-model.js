import Collection from "./collection"
import Money from "js-money"

export default class {
  static modelClassData() {
    throw "modelClassData should be overriden by child"
  }

  static find(id) {
    return new Promise((resolve, reject) => {
      var urlToUse = this.modelClassData().path + "/" + id

      var xhr = new XMLHttpRequest()
      xhr.open("GET", urlToUse)
      xhr.setRequestHeader("X-CSRF-Token", this._token())
      xhr.onload = () => {
        if (xhr.status == 200) {
          var response = JSON.parse(xhr.responseText)

          var modelClass = require("ApiMaker/Models/" + this.modelClassData().name).default
          var model = new modelClass(response.model)
          resolve(model)
        } else {
          reject({"responseText": xhr.responseText})
        }
      }
      xhr.send()
    })
  }

  static ransack(query = {}) {
    return new Collection({"modelName": this.modelClassData().name, "ransack": query, "targetPathName": this.modelClassData().path})
  }

  constructor(modelData = {}) {
    this.changes = {}
    this.relationshipsCache = {}
    this.modelData = modelData
    this._preloadRelationships()
  }

  assignAttributes(newAttributes) {
    for(var key in newAttributes) {
      var oldValue = this.modelData[key]
      var newValue = newAttributes[key]

      if (oldValue != newValue)
        this.changes[key] = newValue
    }
  }

  hasChanged() {
    if (this.changes.length > 0) {
      return true
    } else {
      return false
    }
  }

  create() {
    return new Promise((resolve, reject) => {
      var paramKey = this.constructor.modelClassData().paramKey
      var urlToUse = this.constructor.modelClassData().path
      var modelData = Object.assign({}, this.modelData, this.changes)
      var dataToUse = {}
      dataToUse[paramKey] = modelData

      var xhr = new XMLHttpRequest()
      xhr.open("POST", urlToUse)
      xhr.setRequestHeader("Content-Type", "application/json")
      xhr.setRequestHeader("X-CSRF-Token", this.constructor._token())
      xhr.onload = () => {
        if (xhr.status == 200) {
          var response = JSON.parse(xhr.responseText)

          if (response.model) {
            this.modelData = response.model
            this.changes = {}
          }

          if (response.success) {
            resolve({"model": this, "response": response})
          } else {
            reject({"model": this, "response": response})
          }
        } else {
          reject({"model": this, "responseText": xhr.responseText})
        }
      }
      xhr.send(JSON.stringify(dataToUse))
    })
  }

  destroy() {
    return new Promise((resolve, reject) => {
      var urlToUse = this.constructor.modelClassData().path + "/" + this._primaryKey()

      var xhr = new XMLHttpRequest()
      xhr.open("DELETE", urlToUse)
      xhr.setRequestHeader("X-CSRF-Token", this.constructor._token())
      xhr.onload = () => {
        if (xhr.status == 200) {
          var response = JSON.parse(xhr.responseText)
          if (response.model) {
            this.modelData = response.model
            this.changes = {}
          }

          if (response.success) {
            resolve(response)
          } else {
            reject(response)
          }
        } else {
          reject({"model": this, "responseText": xhr.responseText})
        }
      }
      xhr.send()
    })
  }

  isNewRecord() {
    if ("id" in this.modelData) {
      return false
    } else {
      return true
    }
  }

  isPersisted() {
    return !this.isNewRecord()
  }

  reload() {
    return new Promise((resolve, reject) => {
      var urlToUse = this.constructor.modelClassData().path + "/" + this._primaryKey()

      var xhr = new XMLHttpRequest()
      xhr.open("GET", urlToUse)
      xhr.setRequestHeader("X-CSRF-Token", this.constructor._token())
      xhr.onload = () => {
        if (xhr.status == 200) {
          var response = JSON.parse(xhr.responseText)

          if (response.model) {
            this.modelData = response.model
            this.changes = {}
          }

          resolve(response)
        } else {
          reject({"model": this, "responseText": xhr.responseText})
        }
      }
      xhr.send()
    })
  }

  save() {
    if (this.isNewRecord()) {
      return this.create()
    } else {
      return this.update()
    }
  }

  update(newAttributes = null) {
    if (newAttributes)
      this.assignAttributes(newAttributes)

    return new Promise((resolve, reject) => {
      if (this.changes.length == 0)
        return resolve({model: this})

      var paramKey = this.constructor.modelClassData().paramKey
      var urlToUse = this.constructor.modelClassData().path + "/" + this._primaryKey()
      var dataToUse = {}
      dataToUse[paramKey] = this.changes

      var xhr = new XMLHttpRequest()
      xhr.open("PATCH", urlToUse)
      xhr.setRequestHeader("Content-Type", "application/json")
      xhr.setRequestHeader("X-CSRF-Token", this.constructor._token())
      xhr.onload = () => {
        if (xhr.status == 200) {
          var response = JSON.parse(xhr.responseText)

          if (response.model) {
            this.modelData = response.model
            this.changes = {}
          }

          if (response.success) {
            resolve({"model": this, "response": response})
          } else {
            reject({"model": this, "response": response})
          }
        } else {
          reject({"model": this, "responseText": xhr.responseText})
        }
      }
      xhr.send(JSON.stringify(dataToUse))
    })
  }

  isValid() {
    throw "Not implemented yet"
  }

  _getAttribute(attributeName) {
    if (attributeName in this.changes) {
      return this.changes[attributeName]
    } else if (attributeName in this.modelData) {
      return this.modelData[attributeName]
    } else {
      throw "No such attribute: " + attributeName
    }
  }

  _getAttributeDateTime(attributeName) {
    var value = this._getAttribute(attributeName)
    if (!value)
      return value

    // Format is 2018-07-22T06:17:08.297Z
    var match = value.match(/^(\d+)-(\d+)-(\d+)T(\d+):(\d+):(\d+)\.(\d+)Z$/)

    // Sometimes format is 2018-06-17T09:19:12.576+02:00
    if (!match)
      match = value.match(/^(\d+)-(\d+)-(\d+)T(\d+):(\d+):(\d+)\.(\d+)\+(\d+):(\d+)$/)

    if (match.length > 0) {
      return new Date(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5]), parseInt(match[6]))
    } else {
      throw "Could not read datetime: " + value
    }
  }

  _isPresent(value) {
    if (!value) {
      return false
    } else if (value.match(/^\s*$/)) {
      return false
    }

    return true
  }

  _getAttributeMoney(attributeName) {
    var value = this._getAttribute(attributeName)
    var cents = parseFloat(value.fractional)
    var currency = value.currency.iso_code
    var money = Money.fromInteger(cents, currency)
    return money
  }

  _preloadRelationships() {
    var modelClassData = this.constructor.modelClassData()
    var thisModelData = this.modelData

    for(var key in modelClassData.relationships) {
      var relationship = modelClassData.relationships[key]
      var preloadedData = this.modelData[relationship.name]

      if (!preloadedData)
        continue

      var modelClass = require("ApiMaker/Models/" + relationship.className).default

      if (relationship.macro == "belongs_to" || relationship.macro == "has_one") {
        var modelInstance = new modelClass(preloadedData)
        this.relationshipsCache[relationship.name] = modelInstance
        delete this.modelData[relationship.name]
      } else if(relationship.macro == "has_many") {
        var preloadedModels = []
        for(var key in preloadedData) {
          var modelData = preloadedData[key]
          var modelInstance = new modelClass(modelData)
          preloadedModels.push(modelInstance)
        }

        this.relationshipsCache[relationship.name] = preloadedModels
        delete this.modelData[relationship.name]
      } else {
        console.log("Cannot preload this type of relationship yet: " + relationship.name + " - " + relationship.macro)
      }
    }
  }

  _readBelongsToReflection(args) {
    return new Promise((resolve, reject) => {
      if (this.relationshipsCache[args.reflectionName])
        return resolve(this.relationshipsCache[args.reflectionName])

      var collection = new Collection(args)
      collection.first().then((model) => {
        this.relationshipsCache[args.reflectionName] = model
        resolve(model)
      })
    })
  }

  _readHasOneReflection(args) {
    return new Promise((resolve, reject) => {
      if (this.relationshipsCache[args.reflectionName])
        return resolve(this.relationshipsCache[args.reflectionName])

      var collection = new Collection(args)
      collection.first().then((model) => {
        this.relationshipsCache[args.reflectionName] = model
        resolve(model)
      })
    })
  }

  _primaryKey() {
    return this._getAttribute(this.constructor.modelClassData().primaryKey)
  }

  static _token() {
    var csrfTokenElement = document.querySelector("meta[name='csrf-token']")
    if (csrfTokenElement)
      return csrfTokenElement.getAttribute("content")
  }
}

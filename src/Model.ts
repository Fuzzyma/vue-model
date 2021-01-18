import { computed, ComputedRef, isReactive, reactive, Ref, toRaw } from 'vue'

export const ADD = Symbol('ADD')
export const DELETE = Symbol('DELETE')

type Class = { new(...args: any[]): any; };
type Callback = (data?: unknown) => any

const uuid = () => (Math.random() * 10000000).toString(16)

type withValue<T> = {
  new: () => T
  valueOf(): T
}

/* eslint-disable @typescript-eslint/ban-types */
type returnPrimitive<T extends any> = T extends String ? string
  : T extends Number ? number
  : T extends Boolean ? boolean
  : T extends Symbol ? symbol
  : T

type PrimitiveWrapper = String | Number | Boolean | Symbol
/* eslint-enable */

type ctor<T = any> = {
  new(...args: any[]): T// & { valueOf(): returnPrimitive<T>}
  [s: string]: any
}

// export function field (fn: (...args: any[]) => Field, ...args: any[]) {
//   return (target: Model, propertyKey: string) => {
//     console.log(target, propertyKey)
//     target.constructor._fields[propertyKey] = () => fn(...args)
//   }
// }

function getModel<T extends Model = Model> (model: ctor<T> | string) {
  const ret = typeof model === 'string' ? modelRegistry.get(model) as unknown as ctor<T> : model
  if (!ret) throw new Error('Couldnt find model ' + model + ' in modelRegistry. Is it imported and booted?')
  return ret
}

function getPivotModel (
  model1: typeof Model | string,
  model2: typeof Model | string,
  foreignKey1: string,
  foreignKey2: string,
  otherKey1: string,
  otherKey2: string
) {
  const model1Class = getModel(model1)
  const model2Class = getModel(model2)

  const name = [ model1Class.name, model2Class.name ].sort().join('_')
  const wrapper = {} as Record<string, typeof Model>

  wrapper[name] = getModel(name) as typeof Model

  if (!wrapper[name]) {
    wrapper[name] = class extends Model {
      static fields () {
        return {
          id: this.uid(),
          [foreignKey1]: this.string(null),
          [foreignKey2]: this.string(null),
          [camelCase(model1Class.name)]: this.belongsTo(model1Class, foreignKey1, otherKey1),
          [camelCase(model2Class.name)]: this.belongsTo(model2Class, foreignKey2, otherKey2)
        } as {[s: string]: Field<any>}
      }
    }
  }

  return wrapper[name].boot()
}

export function prop (fn: (...args: any[]) => Field, ...args: any[]) {
  return (target: Model, propertyKey: string) => {
    target.constructor._fields[propertyKey] = () => fn.apply(Model, args)
  }
}

export function nullable (target: Model, propertyKey: string) {
  const field = target.constructor._fields[propertyKey]().nullable()
  target.constructor._fields[propertyKey] = () => field
}

function createNumber (defaultValue?: any) {
  return new Field(defaultValue, Number)
}

function createString (defaultValue?: any) {
  return new Field(defaultValue, String)
}

function createBoolean (defaultValue?: any) {
  return new Field(defaultValue, Boolean)
}

function createArray<T> (defaultValue = [], object: ctor<T> /* | ((arg: any) => T) */) {
  return new Field(defaultValue, object)
}

function createObject<T> (defaultValue = {}, object: ctor<T> /* | ((arg: any) => T) */) {
  return new Field(defaultValue, object)
}

function createField<T> (defaultValue: any, object: ctor<T> /* | ((arg: any) => T) */) {
  return new Field(defaultValue, object)
}

function createUid () {
  return createString(uuid)
}

function createComputed<T> (getter: (context: Model) => T, setter = (context: Model, val: any) => { /* */ }) {
  return new ComputedField(getter, setter)
}

function createHasOne<T extends Model> (this: ctor, related: ctor<T> | string, foreignKey = camelCase(getModel(this).name) + 'Id', otherKey?: string) {
  return new HasOne<T>(related, foreignKey, otherKey)
}

function createHasMany<T extends Model> (this: ctor, related: ctor<T> | string, foreignKey = camelCase(getModel(this).name) + 'Id', otherKey?: string) {
  return new HasMany(related, foreignKey, otherKey)
}

function createHasManyBy<T extends Model> (related: ctor<T> | string, foreignKey = camelCase(getModel(related).name) + 'Ids', otherKey?: string) {
  return new HasManyBy(related, foreignKey, otherKey)
}

function createBelongsTo<T extends Model> (related: ctor<T> | string, foreignKey = camelCase(getModel(related).name) + 'Id', otherKey?: string) {
  return new BelongsTo(related, foreignKey, otherKey)
}

function createBelongsToMany<T extends Model> (
  this: typeof Model,
  related: typeof Model,
  pivot?: typeof Model,
  foreignKey1 = camelCase(getModel(this).name) + 'Id',
  foreignKey2 = camelCase(getModel(related).name) + 'Id',
  otherKey1 = this.primaryKey,
  otherKey2 = related.primaryKey
) {
  if (!pivot) pivot = getPivotModel(this, related, foreignKey1, foreignKey2, otherKey1, otherKey2)
  return new BelongsToMany(related, pivot, foreignKey1, foreignKey2, otherKey1, otherKey2)
}

export function number (defaultValue?: any) {
  return prop(createNumber, defaultValue)
}

export function string (defaultValue?: any) {
  return prop(createString, defaultValue)
}

export function boolean (defaultValue?: any) {
  return prop(createBoolean, defaultValue)
}

export function array (defaultValue = [], object: Class = Object) {
  return prop(createArray, defaultValue, object)
}

export function object (defaultValue?: any, object: Class = Object) {
  return prop(createObject, defaultValue, object)
}

export function field (defaultValue?: any, object: Class = Object) {
  return prop(createObject, defaultValue, object)
}

export function uid () {
  return prop(createUid)
}

export function hasOne (related: ctor<Model> | string, foreignKey?: string, otherKey?: string) {
  return prop(createHasOne, related, foreignKey, otherKey)
}

export function hasMany (related: ctor<Model> | string, foreignKey?: string, otherKey?: string) {
  return prop(createHasMany, related, foreignKey, otherKey)
}

export function hasManyBy (related: ctor<Model> | string, foreignKey?: string, otherKey?: string) {
  return prop(createHasManyBy, related, foreignKey, otherKey)
}

export function belongsTo (related: ctor<Model> | string, foreignKey?: string, otherKey?: string) {
  return prop(createBelongsTo, related, foreignKey, otherKey)
}

const filterRelation = (fields: [string, Field<any>][]) => fields.filter(([ name, field ]) =>
  field instanceof Relation && !isLocal(field)
) as [string, Relation][]

const initCache = (fields: [string, Field<any>][], values: Record<string, unknown>, cache: Record<string, unknown> = {}) => fields.reduce((cache, [ name, field ]) => {
  if (!(field instanceof Relation)) {
    cache[name] = field.getValue(values[name])
  }
  return cache
}, cache)

const checker = (conditions: Record<string, unknown> | ((m: Model) => boolean)) => {
  if (typeof conditions === 'function') return conditions

  const entries = Object.entries(conditions)
  return (m: Model) => {
    let ret = true
    for (const [ key, value ] of entries) {
      ret = ret && m[key] === value
      if (!ret) break
    }

    return ret
  }
}

const getBaseClass = (type: string | ctor<Model>) => {
  let Type = getModel(type)
  while (Type.base) {
    Type = Type.base
  }
  return Type
}

export class Model {
  ['constructor']: typeof Model

  static isBooted:boolean
  // eslint-disable-next-line no-use-before-define
  static __fields: { [s: string]: () => Field } = {}
  static entity = 'models'
  static primaryKey = 'id'
  static typeField = 'type'
  static base:string|ctor<Model>|null = null
  static _cache = new Map()
  static _keyFields = new Map()

  static get cache (): Map<string | number, Model> {
    if (this.base) {
      return getModel(this.base).cache
    }

    if (!Object.hasOwnProperty.call(this, '_cache')) {
      this._cache = new Map()
    }
    return this._cache
  }

  static get keyFields (): Map<string, Map<typeof Model, [string, Relation]>> {
    if (this.base) {
      return getModel(this.base).keyFields
    }

    if (!Object.hasOwnProperty.call(this, '_keyFields')) {
      this._keyFields = new Map()
    }
    return this._keyFields
  }

  static get _fields (): { [s: string]: () => Field } {
    if (!Object.hasOwnProperty.call(this, '__fields')) {
      this.__fields = {}
    }
    return this.__fields
  }

  static boot () {
    if (Object.hasOwnProperty.call(this, 'isBooted')) {
      return this
    }

    console.log('Booting', this.name)
    modelRegistry.set(this.name, this)
    this.isBooted = true
    return this
  }

  static fields (): { [s: string]: Field } {
    return Object.assign({
      [this.primaryKey]: this.uid()
    }, Object.fromEntries(Object.entries(this._fields).map(([ name, fn ]) => [ name, fn() ])))
  }

  static types (): { [s:string]: typeof Model} {
    return {}
  }

  static cascades (): string[] {
    return []
  }

  static number = createNumber
  static string = createString
  static boolean = createBoolean
  static array = createArray
  static object = createObject
  static field = createField
  static uid = createUid
  static computed = createComputed
  static hasOne = createHasOne
  static hasMany = createHasMany
  static hasManyBy = createHasManyBy
  static belongsTo = createBelongsTo
  static belongsToMany = createBelongsToMany

  static whereFirst<T extends typeof Model> (this: T, condition: Record<string, unknown> | ((m:Model) => boolean)): InstanceType<T> | null {
    return [ ...this.cache.values() ].find(checker(condition)) as InstanceType<T> || null
  }

  static where<T extends typeof Model> (this: T, condition: Record<string, unknown> | ((m:Model) => boolean)): InstanceType<T>[] {
    return [ ...this.cache.values() ].filter(checker(condition)) as InstanceType<T>[]
  }

  static all<T extends typeof Model> (this: T): InstanceType<T>[] {
    return [ ...this.cache.values() ] as InstanceType<T>[]
  }

  static getPerRelation (field: Relation, id: string | number) {
    if (field.otherKey !== this.primaryKey) {
      return this.whereFirst({
        [field.otherKey]: id
      })
    } else {
      return this.get(id) as Model
    }
  }

  get $id () {
    return this[this.constructor.primaryKey]
  }

  _events!: { [s: string]: Set<Callback> }
  _cache!: Record<string, any>
  _foreignKeyCache!: Record<string, any>

  [key: string]: any

  /**
   * Creates a new instance of the model without saving it to the registry
   * @param values Initial values for the model
   */
  constructor (values: Record<string, unknown> = {}) {
    // eslint-disable-next-line
    // @ts-ignore
    const ctor = this.constructor

    // TODO: Make boot call static functions (e.g. fields) to cache them
    ctor.boot()

    const types = ctor.types()

    // Make sure that the type for any created model is correct
    if (values[ctor.typeField] && types[values[ctor.typeField] as string] !== ctor) {
      const Model = getModel(types[values[ctor.typeField] as string])
      return new Model(values)
    }

    const fieldEntries = Object.entries(ctor.fields())

    this._initPrivateProperties(fieldEntries, values)
    this._observeRelations(fieldEntries)
    this._initFields(fieldEntries)
    this._setRelations(fieldEntries, values)
  }

  /**
   * Creates private events, cache and foreignKeyCache
   */
  _initPrivateProperties (fieldEntries: [string, Field<any>][], values: Record<string, unknown>) {
    const cache = initCache(fieldEntries, values, isReactive(values) ? values : {})

    Object.defineProperties(this, {
      _events: {
        enumerable: false,
        value: {}
      },
      _cache: {
        enumerable: false,
        value: reactive(cache)
      },
      _foreignKeyCache: {
        enumerable: false,
        value: reactive({})
      }
    })
  }

  /**
   * Collect all relations of this model and subscribe to changes of them
   */
  _observeRelations (fieldEntries: [string, Field<any>][]) {
    const relations = filterRelation(fieldEntries)

    // make sure this model is informed when a related model was created
    // so we can add it to the corresponding cache array
    relations.forEach(([ name, field ]) => {
      const ctor = getBaseClass(this.constructor)
      field.Type._subscribe(ctor, name, field)
    })
  }

  /**
   * Create getter for all fields
   */
  _initFields (fieldEntries: [string, Field<any>][]) {
    fieldEntries.forEach(([ name, field ]) => {

      if (field instanceof Relation) {

        // Getters and setters for relations
        Object.defineProperty(this, name, {
          get: this._getRelationFactory(name, field),
          set: this._setRelationFactory(name, field),
          enumerable: true
        })

      } else if (field instanceof ComputedField) {

        // Getters and setters for computed fields
        field.createComputed(this)
        Object.defineProperty(this, name, {
          get () { return field.value },
          set (val) { field.value = val },
          enumerable: true
        })

      } else {

        // Getters and setters for "key" attributes and normal ones
        Object.defineProperty(this, name, {
          get: this._getAttrFactory(name, field),
          set: this._setKeyFactory(name, field),
          enumerable: true
        })

      }
    })
  }

  /**
   * Assigns relations by creating the related Models if needed and setting the corresponding keys
   * by assigning it via relation setter
   */
  _setRelations (fieldEntries: [string, Field<any>][], values: Record<string, unknown>) {
    fieldEntries.forEach(([ name, field ]) => {
      if (field instanceof Relation) {
        const val = values[name]
        if (val) {

          // TODO: Check if model exists before creating it
          // Any value passed into getValue gets converted to the type of the Relation
          const rel = (field as Relation<Model>).getValue(val) as Model | Array<Model | null>

          // Save the created model
          if (Array.isArray(rel)) {
            rel.forEach(model => model && model.save())
          } else {
            rel.save()
          }

          // Set the relation on the parent
          this[name] = rel
        }
      }
    })
  }

  /**
   * Getter factory which returns a getter used when accessing attributes
   * @param name The attribute name given in the fields method
   * @param field The field object
   * @returns a function which serves as getter for the specified attribute
   */
  _getAttrFactory (name: string, field: Field) {
    return () => this._cache[name]
  }

  /**
   * Setter factory which returns a setter used when accessing attributes
   * @param name The attribute name given in the fields method
   * @param field The field object
   * @returns a function which serves as setter for the specified attribute
   */
  _setAttrFactory (name: string, field: Field) {
    return (val: any) => {
      this._cache[name] = field.getValue(val) // .valueOf()
    }
  }

  /**
   * When a field is set whose content is the foreignKey for another model (or models),
   * we have to make sure that the other model is notified that the relation just broke
   * and a new other model must be notified that a relation was added */
  _setKeyFactory (name: string, field: Field) {

    const setKey = this._setAttrFactory(name, field)

    return (newVal: string | number) => {
      const oldVal = this[name] as string | number

      if (newVal === oldVal) return

      // console.log('setting field', name, 'to', newVal)

      // If this is a normal field or the instancce is not saved yet
      // just set the value without informing any models
      if (!this.constructor.keyFields.has(name) || !this.constructor.cache.has(this.$id)) {
        return setKey(newVal)
      }

      console.log('foreignKey', name, 'was set with', newVal)

      // Get subscribers for this field
      const parents = this.constructor.keyFields.get(name) as Map<typeof Model, [string, Relation]>

      // ?. makes sure that subscriber exists

      // Find old subscriber and remove model from their cache
      parents.forEach(([ nameInParentModel, fieldInParentModel ], Parent) => {
        const subscriber = Parent.getPerRelation(fieldInParentModel, oldVal)
        subscriber?._updateRelationCache(nameInParentModel, fieldInParentModel, DELETE, this)
      })

      // Actually do the change
      setKey(newVal)

      // Find new subscriber and add model to their cache
      parents.forEach(([ nameInParentModel, fieldInParentModel ], Parent) => {
        const subscriber = Parent.getPerRelation(fieldInParentModel, newVal)
        subscriber?._updateRelationCache(nameInParentModel, fieldInParentModel, ADD, this)
      })
    }
  }

  /**
   * Getter factory that creates a getter used when accessing a relation of a model
   * @param name The attribute name given in the fields method
   * @param field The Relation object
   * @returns a function which serves as getter for the specified relation
   */
  _getRelationFactory (name: string, field: Relation) {
    const local = isLocal(field)
    const cache = local ? this._cache : this._foreignKeyCache
    const hash = local ? field.foreignKey : name

    return () => {
      // This is only ever executed on non-local relations because
      // the _cache (where the local relations keys live) is always already initialized
      if (cache[hash] === undefined) {
        console.log('Init relation on', this.constructor.name, hash)
        this._initializeRelation(hash, field)
      }

      const relation = field.resolveRelation(cache[hash])
      return relation
    }
  }

  /**
   * Setter factory that creates a setter used when setting a relation of a model
   * @param name The attribute name given in the fields method
   * @param field The Relation object
   * @returns a function which serves as setter for the specified relation
   */
  _setRelationFactory (name: string, field: Relation) {

    return (val: Record<string, unknown> | Record<string, unknown>[]) => {

      const isLocalField = isLocal(field)

      if (!Array.isArray(val)) {
        val = [ val ]
      }

      const models = val.map((v) => {
        if (!isLocalField) {
          v[field.foreignKey] = this.$id
        }

        if (v instanceof Model) {
          return v
        }

        return new field.Type(v)
      })

      // We dont have notifications for local models. Therefore we have to set the ids direcly
      const _this = this as any
      if (field instanceof BelongsTo) {
        _this[field.foreignKey] = models[0].$id
      } else if (field instanceof HasManyBy) {
        const ids = models.map(m => m.$id)
        _this[field.foreignKey] = [ ...new Set([ ...(this as any)[field.foreignKey], ...ids ]) ]
      }

    }
  }

  /**
   * This method searches for the related models once its first accessed
   * @param name The attribute name given in the fields method
   * @param field The relation object
   */
  _initializeRelation (name: string, field: Relation) {
    // Local relations are already initialized
    if (isLocal(field)) {
      return
    }

    const isMany = field instanceof HasMany

    const ids = []
    // Loop through all related models and gather ids
    for (const [ id, model ] of field.Type.cache as Map<string | number, Model>) {
      if (model[field.foreignKey] === this[field.otherKey]) {
        ids.push(id)
      }
      if (!isMany) break
    }

    this._foreignKeyCache[name] = isMany ? ids : (ids[0] ?? null)
  }

  /**
   * Gets one or multiple models by id
   * @param idOrIds An id or array of ids
   */
  static get<T extends typeof Model> (this: T, id: string | number): InstanceType<T> | null
  static get<T extends typeof Model> (this: T, ids: (string | number)[]): InstanceType<T>[]
  static get<T extends typeof Model> (this: T, idOrIds: (string | number)[] | string | number): InstanceType<T>[] | InstanceType<T> | null {

    if (Array.isArray(idOrIds)) {
      return idOrIds.map((id) => this.cache.get(id)).filter((a) => a !== undefined) as InstanceType<T>[]
    }

    return this.cache.get(idOrIds) as InstanceType<T> ?? null
  }

  /**
   * Gets one or multiple models by id or creates them if not existent
   * @param idOrIds An id or array of ids
   */
  static getOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>): InstanceType<T> | null
  static getOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>[]): InstanceType<T>[]
  static getOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>[] | Record<string, unknown>): InstanceType<T>[] | InstanceType<T> | null {
    const isArray = Array.isArray(values)
    const arr = (isArray ? values : [ values ]) as Record<string, unknown>[]

    const result = arr.map((values) => {
      if (this.cache.has(values[this.primaryKey] as number)) {
        return this.get(values[this.primaryKey] as number)
      }

      return this.create(values)
    })

    return isArray ? result as InstanceType<T>[] : result[0] as InstanceType<T>
  }

  /**
   * Gets one or multiple models by id or creates them if not existent
   * @param idOrIds An id or array of ids
   */
  static fillOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>): InstanceType<T> | null
  static fillOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>[]): InstanceType<T>[]
  static fillOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>[] | Record<string, unknown>): InstanceType<T>[] | InstanceType<T> | null {
    const isArray = Array.isArray(values)
    const arr = (isArray ? values : [ values ]) as Record<string, unknown>[]

    const result = arr.map((values) => {
      if (this.cache.has(values[this.primaryKey] as number)) {
        return this.get(values[this.primaryKey] as number)?.fill(values)
      }

      return this.create(values)
    })

    return isArray ? result as InstanceType<T>[] : result[0] as InstanceType<T>
  }

  /**
   * Static way of creating a model
   * @param values Initial values
   */
  static make<T extends typeof Model> (this: T, values = {}): InstanceType<T> {
    return new this(values) as InstanceType<T>
  }

  /**
   * Create model and save it
   * @param value Initial values
   */
  static create<T extends typeof Model> (this: T, value: Record<string, unknown>): InstanceType<T>
  static create<T extends typeof Model> (this: T, values: Record<string, unknown>[]): InstanceType<T>[]
  static create<T extends typeof Model> (this: T, value: Record<string, unknown> | Record<string, unknown>[] = {}) {
  // static create<T extends typeof Model> (this: T, value = {}): InstanceType<T> {
    if (Array.isArray(value)) return this.createAll(value)
    return this.make(value).save() as InstanceType<T>
  }

  static createAll<T extends typeof Model> (this: T, values:Record<string, unknown>[] = []): InstanceType<T>[] {
    return values.map((value) => this.make(value).save() as InstanceType<T>)
  }

  /**
   * Subscribes a parent model to changes on the child model
   * @param Parent Subscriber to be notified on changes
   * @param nameInParentModel Name of field defined on the parent model
   * @param fieldInParentModel Field object
   */
  static _subscribe (Parent: typeof Model, nameInParentModel: string, fieldInParentModel: Relation) {
    console.log(Parent.name, 'wants to subscribe to updates on', this.name)

    // Get all parents subscribed to this key
    let parents = this.keyFields.get(fieldInParentModel.foreignKey)

    // If there is none, initialize it
    if (parents === undefined) {
      parents = new Map<typeof Model, [string, Relation]>()
      this.keyFields.set(fieldInParentModel.foreignKey, parents)
    }

    // Add the parent to subscibers
    if (!parents.has(Parent)) {
      parents.set(Parent, [ nameInParentModel, fieldInParentModel ])
    }
  }

  /**
   * Notify all subscribers so they can update their cache
   * @param type Type of change in the Model (ADD / DELETE)
   */
  _notifySubscribers (type: symbol) {
    // keyFields.get(foreignKey).get(subscriber)[nameInParentModel] = fieldInParentModel
    console.log(this.constructor.name, 'is notifying its dependents with', type)
    this.constructor.keyFields.forEach((parents, foreignKey) => {
      parents.forEach(([ nameInParentModel, fieldInParentModel ], Parent) => {
        // value of the foreignKey
        const id = this[foreignKey] as (string|number)

        // Get the parent model from registry
        const model = Parent.getPerRelation(fieldInParentModel, id) as Model

        // If model doesnt exist, we cant notify it. So we return here
        // It basically means that a model has an id set as foreignKey even though the related model doesnt exist
        // This is either because of bad code or cyclic deletion
        if (!model) return

        // Update the cache
        model._updateRelationCache(nameInParentModel, fieldInParentModel, type, this)
      })
    })
  }

  /**
   * Updates the relation cache
   * @param name Name of the relation field
   * @param field Relation object
   * @param type Type of change (ADD / DELETE)
   * @param child The model that changed
   */
  _updateRelationCache (name: string, field: Relation, type: symbol, child: Model) {
    console.log('update cache for', this.constructor.name, 'notified by', child.constructor.name, 'local=', isLocal(field), 'fieldname=', name)

    const isMany = field instanceof HasMany
    const cache = this._foreignKeyCache

    // If the cache is undefined, it means the Relation wasnt yet accessed loaded
    // So we would need to load it before we can update it
    // No need to waste time on that if it isnt needed anyway
    if (cache[name] === undefined) {
      return
    }

    if (type === ADD) {

      if (isMany) {
        // add to the array if it isnt in the array
        if (!cache[name].includes(child.$id)) {
          cache[name].push(child.$id)
        }
      } else {
        cache[name] = child.$id
      }

    } else if (type === DELETE) {

      if (isMany) {
        // only delete if it exists
        const index = cache[name].indexOf(child.$id)
        if (index > -1) {
          cache[name].splice(index, 1)
        }
      } else {
        // setting it to null makes it possible to check for undefined above
        cache[name] = null
      }

    }
  }

  /**
   * Loops through listeners and calls them
   * @param event Name of the event to be emitted
   * @param data Data to be passed to the event handler
   */
  emit (event: string, data?: unknown) {
    // runs all listener and returns false if any of the listener returns false
    return [ ...this._events[event] || [] ].reduce((acc, cb) => cb(data) && acc, true)
  }

  /**
   * Binds a listener to an event
   * @param event Name of the event to be listend to
   * @param cb Listener
   */
  on (event: string, cb: Callback) {
    if (!this._events[event]) {
      this._events[event] = new Set()
    }
    this._events[event].add(cb)
  }

  /**
   * Unbinds a listener to an event
   * @param event Name of the event to be unbound
   * @param cb Listener
   */
  off (event: string, cb: Callback) {
    if (!this._events[event]) return

    this._events[event].delete(cb)
  }

  /**
   * Delete the model from registry
   */
  delete () {
    if (this.emit('delete') === false) return this

    this._triggerCascadeDeletion()
    this._notifySubscribers(DELETE)
    this.constructor.cache.delete(this.$id)

    this.emit('deleted')

    return this
  }

  valueOf () {
    return this
  }

  toJSON () {
    return this.toObject()
  }

  /**
   * Gives back model as object for further consumption
   */
  toObject (withRelations = false) {
    const obj = toRaw(this._cache)

    if (withRelations) {
      const fieldEntries = Object.entries(this.constructor.fields())
      fieldEntries.forEach(([ name, field ]) => {
        if (!isLocal(field as Relation)) {
          const models = this[name] as Model | Model[]
          obj[name] = Array.isArray(models) ? models.map((model) => model.toObject(true)) : models
        }
      })
    }

    return obj
  }

  /**
   * Saves the model in the registry
   */
  save () {
    if (this.constructor.cache.has(this.$id)) {
      const model = (this.constructor.cache.get(this.$id) as Model)
      if (model === this) return this
      // https://github.com/microsoft/TypeScript/issues/13086
      return model.fill(this.toObject())
    }

    this.constructor.cache.set(this.$id, this)
    this._notifySubscribers(ADD)
    return this
  }

  /**
   * Sets multiple attributes at once
   * @param values The values to be bulk set
   */
  fill (values: Record<string, unknown> = {}) {
    const fieldEntries = Object.entries(this.constructor.fields())
    initCache(fieldEntries, values, this._cache)
    this._setRelations(fieldEntries, values)

    return this
  }

  _triggerCascadeDeletion () {
    const cascades = this.constructor.cascades()

    cascades.forEach((name) => {
      this[name].delete()
    })
  }

  clone<T extends Model> (this:T, relations?: string[]) {
    return this.constructor.make(this.toObject()) as typeof this
  }

  copy<T extends Model> (this:T, relations?: string[]) {
    return this.constructor.make({ ...this.toObject, [this.primaryKey]: undefined }) as typeof this
  }
}

function createCollection (parent: Model, Child: typeof Model, field: Relation) {
  class Collection extends Array {
    create (objOrArr: Record<string, unknown> | Record<string, unknown>[]) {
      const arr = Array.isArray(objOrArr) ? objOrArr : [ objOrArr ]
      arr.forEach(o => Child.create({ ...o, [field.foreignKey]: parent[field.otherKey] }))
    }

    assign (idOrIds: number | string | Array<number|string>) {
      const ids = Array.isArray(idOrIds) ? idOrIds : [ idOrIds ]

      ids.forEach((id) => {
        Child.get(id)![field.foreignKey] = parent[field.otherKey]
      })
    }
  }
}

// const makeFactory = (Type: ctor) => (arg: any) => arg instanceof Type ? arg : new Type(arg)

function isPrimitiveWrapper<T> (Type: T) {
  return Type instanceof String || Type instanceof Number || Type instanceof Boolean
}

function convertPrimitive<T> (value: any, Type: ctor<T>|undefined): returnPrimitive<T> {
  if (!Type) return value
  const instance = value instanceof Type ? value : new Type(value)
  return isPrimitiveWrapper(instance) ? (instance as any).valueOf() : instance
}

export class Field<T extends unknown = unknown> {
  // static type = type
  isNullable = false
  defaultValue: unknown = null
  Type: ctor<T> | undefined

  constructor (defaultValue: any, Type?: ctor<T>/* | ((arg: any) => T), isFactory = false */) {
    this.defaultValue = defaultValue
    // this.Type = isFactory ? Type as (arg: any) => T : makeFactory(Type as ctor<T>)
    this.Type = Type
    if (defaultValue === null) {
      this.nullable()
    }
  }

  nullable (trueOrFalse = true) {
    this.isNullable = trueOrFalse
    return this
  }

  // getValue (value: unknown) {
  getValue (value: unknown): returnPrimitive<T> | null
  getValue (values:unknown[]): returnPrimitive<T>[] | null
  getValue (value: unknown[] | unknown): returnPrimitive<T> | returnPrimitive<T>[] | null {
    return this.sanitize(value ?? this.getDefault())
  }

  getDefault () {
    if (typeof this.defaultValue === 'function') {
      return this.defaultValue()
    }

    return this.defaultValue
  }

  sanitize (value: unknown): returnPrimitive<T> | null
  sanitize (values:unknown[]): returnPrimitive<T>[] | null
  sanitize (value: unknown[] | unknown): returnPrimitive<T> | returnPrimitive<T>[] | null {
  // sanitize (value: unknown | unknown[]) {
    if (value === null) {
      if (!this.isNullable) {
        throw new Error('Field is not nullable')
      }
      return null
    }

    if (Array.isArray(value)) {
      return value.map((v) => convertPrimitive(v, this.Type))
    }

    return convertPrimitive(value, this.Type)

    // if (isPrimitiveWrapper(this.Type)) return instance.valueOf()
  }
}

const camelCase = (s: string) => {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

export class Relation<T extends Model = Model> extends Field<T> {
  ['constructor']: typeof Relation

  foreignKey: string
  otherKey: string
  order: Array<string>| ((a:T, b:T) => number) | null
  Type!: ctor<T>

  constructor (related: ctor<T> | string, foreignKey: string, otherKey: string = getModel(related).primaryKey, defaultValue: unknown = null) {
    if (typeof related === 'string') {
      related = getModel(related)
    }

    super(defaultValue, related)

    this.foreignKey = foreignKey
    this.otherKey = otherKey

    this.order = null
  }

  orderBy (field: string, direction = 'asc') {
    this.order = [ field, direction ]
    return this
  }

  resolveRelation (id: unknown): T | null
  resolveRelation (ids: unknown[]): T[]
  resolveRelation (ids: unknown[]): T[] | T | null {
    const result = this.Type.get(ids)
    if (Array.isArray(this.order)) {
      const [ field, direction ] = this.order
      result.sort((a:T, b:T) => (a[field] - b[field]) * (direction === 'asc' ? 1 : -1))
    } else if (typeof this.order === 'function') {
      result.sort(this.order)
    }
    return result ?? null
  }
}

export class HasOne<T extends Model> extends Relation<T> {
}

export class BelongsTo<T extends Model> extends Relation<T> {
}

export class HasMany<T extends Model> extends Relation<T> {
  constructor (related: ctor<T> | string, foreignKey: string, otherKey?: string, defaultValue = []) {
    super(related, foreignKey, otherKey, [])
  }
}

export class HasManyBy<T extends Model> extends Relation<T> {
  constructor (related: ctor<T> | string, foreignKey: string, otherKey?: string, defaultValue = []) {
    super(related, foreignKey, otherKey, [])
  }
}

export class BelongsToMany<T extends Model> extends Relation<T> {
  pivot: ctor<Model>
  foreignKey2: string
  otherKey2: string
  constructor (related: ctor<T>, pivot: ctor<Model>, foreignKey1: string, foreignKey2: string, otherKey1: string, otherKey2: string, defaultValue = []) {
    super(related, foreignKey1, otherKey1, [])
    this.pivot = pivot
    this.foreignKey2 = foreignKey2
    this.otherKey2 = otherKey2
  }

  resolveRelation (ids: unknown[]): T[]
  resolveRelation (id: unknown): never
  resolveRelation (ids: unknown[]): T[] {
    return this.pivot.get(ids).map((p: Model) => p[camelCase(this.Type.name)])
  }
}

export class ComputedField<T extends unknown = unknown> extends Field<T> {
  computedValue!: ComputedRef<T>
  value!: T
  getter: (context: Model) => T
  setter: (context: Model, value: any) => void

  constructor (getter: (context: Model) => T, setter: (context: Model, value: any) => void) {
    super(null)
    this.getter = getter
    this.setter = setter
  }

  createComputed (context: Model) {
    this.computedValue = computed<T>(() => this.getter(context))
    Object.defineProperty(this, 'value', {
      get () { return this.computedValue.value },
      set (val) { this.setter(context, val) }
    })
    return this
  }
}

export const modelRegistry = new Map<string, typeof Model>()

const isLocal = (inst: Relation) => inst instanceof BelongsTo || inst instanceof HasManyBy
const isMany = (inst: Relation) => inst instanceof HasMany || inst instanceof HasManyBy

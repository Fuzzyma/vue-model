import { computed, ComputedRef, reactive, shallowReactive, toRaw } from 'vue'

export const ADD = Symbol('ADD')
export const DELETE = Symbol('DELETE')

type Class = { new(...args: any[]): any; };
type Callback = (...data: any[]) => any

export type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];
export type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;

export type Properties<T extends typeof Model> = Partial<NonFunctionProperties<OmitPrivate<T>>>
export type PropertiesInstance<T extends Model> = Partial<NonFunctionProperties<T>>
export type Dehydrate<T extends typeof Model> = Properties<T> & { '__class__': T['model']}
export type PropertyNames<T extends typeof Model> = keyof Properties<T>
export type PropertyNamesInstance<T extends Model> = keyof PropertiesInstance<T>
export type OmitPrivate<T extends typeof Model> = Omit<InstanceType<T>, '_events' | '_cache' | '_foreignKeyCache' | '$id'>
export type RelationPropertyNames<T extends typeof Model> = {
  [P in keyof OmitPrivate<T>]: OmitPrivate<T>[P] extends Model|Model[] ? (OmitPrivate<T>[P] extends Function ? never : P)
    : never
}[keyof OmitPrivate<T>]
export type RelationProperties<T extends typeof Model> = Pick<InstanceType<T>, RelationPropertyNames<T>>;

const uuid = () => (Math.random() * 10000000).toString(16)

let log = false

/* eslint-disable @typescript-eslint/ban-types */
type returnPrimitive<T extends any> = T extends String ? string
  : T extends Number ? number
  : T extends Boolean ? boolean
  : T extends Symbol ? symbol
  : T
/* eslint-enable */

type ctor<T = any> = {
  new(...args: any[]): T// & { valueOf(): returnPrimitive<T>}
  [s: string]: any
}

export type Key = number | string | symbol
type KeyName = string | string[]

// export function field (fn: (...args: any[]) => Field, ...args: any[]) {
//   return (target: Model, propertyKey: string) => {
//     log && console.log(target, propertyKey)
//     target.static()._fields[propertyKey] = () => fn(...args)
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
  foreignKey1: KeyName,
  foreignKey2: KeyName,
  otherKey1: KeyName,
  otherKey2: KeyName
) {
  const model1Class = getModel(model1)
  const model2Class = getModel(model2)

  const name = [ model1Class.model, model2Class.model ].sort().join('_')
  const wrapper = {} as Record<string, typeof Model>

  wrapper[name] = getModel(name) as typeof Model

  if (!wrapper[name]) {

    const arrayKey1 = Array.isArray(foreignKey1) ? foreignKey1 : [ foreignKey1 ]
    // const arrayKey2 = Array.isArray(foreignKey2) ? foreignKey2 : [ foreignKey2 ]

    /* eslint-disable @typescript-eslint/ban-types */
    const fields1 = arrayKey1.reduce((acc, curr) => {
      acc[curr] = createString(null)
      return acc
    }, {} as Record<string, Field<String>>)

    const fields2 = arrayKey1.reduce((acc, curr) => {
      acc[curr] = createString(null)
      return acc
    }, {} as Record<string, Field<String>>)
    /* eslint-enable @typescript-eslint/ban-types */

    wrapper[name] = class extends Model {
      static fields () {
        return {
          id: this.uid(),
          ...fields1,
          ...fields2,
          [camelCase(model1Class.model)]: this.belongsTo(model1Class, foreignKey1, otherKey1),
          [camelCase(model2Class.model)]: this.belongsTo(model2Class, foreignKey2, otherKey2)
        }as {[s: string]: Field<any>}
      }
    }
  }

  return wrapper[name].boot()
}

export function prop (fn: (...args: any[]) => Field, ...args: any[]) {
  return (target: Model, propertyKey: string) => {
    target.static()._fields[propertyKey] = () => fn.apply(Model, args)
  }
}

export function nullable (target: Model, propertyKey: string) {
  const field = target.static()._fields[propertyKey]().nullable()
  target.static()._fields[propertyKey] = () => field
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

function createComputed<T, K> (this: ctor<K>, getter: (context: K) => T, setter = (context: K, val: any) => { /* */ }) {
  return new ComputedField(getter, setter)
}

function createHasOne<T extends Model> (this: ctor, related: ctor<T> | string, foreignKey:KeyName = camelCase(this.model) + 'Id', otherKey:KeyName = this.primaryKey) {
  return new HasOne<T>(this, related, foreignKey, otherKey)
}

function createHasMany<T extends Model> (this: ctor, related: ctor<T> | string, foreignKey:KeyName = camelCase(this.model) + 'Id', otherKey:KeyName = this.primaryKey) {
  return new HasMany(this, related, foreignKey, otherKey)
}

function createHasManyBy<T extends Model> (this: ctor, related: ctor<T> | string, foreignKey:KeyName = camelCase(getModel(related).model) + 'Ids', otherKey:KeyName = getModel(related).primaryKey) {
  return new HasManyBy(this, related, foreignKey, otherKey)
}

function createBelongsTo<T extends Model> (this: ctor, related: ctor<T> | string, foreignKey:KeyName = camelCase(getModel(related).model) + 'Id', otherKey:KeyName = getModel(related).primaryKey) {
  return new BelongsTo(this, related, foreignKey, otherKey)
}

function createBelongsToMany<T extends Model> (
  this: typeof Model,
  related: typeof Model,
  pivot?: typeof Model,
  foreignKey1:KeyName = camelCase(getModel(this).model) + 'Id',
  foreignKey2:KeyName = camelCase(getModel(related).model) + 'Id',
  otherKey1:KeyName = this.primaryKey,
  otherKey2:KeyName = related.primaryKey
) {
  if (!pivot) pivot = getPivotModel(this, related, foreignKey1, foreignKey2, otherKey1, otherKey2)
  return new BelongsToMany(this, related, pivot, foreignKey1, foreignKey2, otherKey1, otherKey2)
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

export function hasOne (related: ctor<Model> | string, foreignKey?: KeyName, otherKey?: KeyName) {
  return prop(createHasOne, related, foreignKey, otherKey)
}

export function hasMany (related: ctor<Model> | string, foreignKey?: KeyName, otherKey?: KeyName) {
  return prop(createHasMany, related, foreignKey, otherKey)
}

export function hasManyBy (related: ctor<Model> | string, foreignKey?: KeyName, otherKey?: KeyName) {
  return prop(createHasManyBy, related, foreignKey, otherKey)
}

export function belongsTo (related: ctor<Model> | string, foreignKey?: KeyName, otherKey?: KeyName) {
  return prop(createBelongsTo, related, foreignKey, otherKey)
}

const filterRelation = (fields: [string, Field<any>][]) => fields.filter(([ name, field ]) =>
  field instanceof Relation && !isLocal(field)
) as [string, Relation][]

const initCache = (fields: [string, Field<any>][], values: Record<string, unknown>, cache: Record<string, unknown> = {}) => fields.reduce((cache, [ name, field ]) => {
  if (!(field instanceof Relation) && !(field instanceof ComputedField)) {
    cache[name] = field.getValue(values[name])
  }
  return cache
}, cache)

function checker<T extends typeof Model> (conditions: Partial<Record<PropertyNames<T>, unknown>> | ((m: InstanceType<T>) => boolean)) {
  if (typeof conditions === 'function') return conditions

  const entries = Object.entries(conditions) as [PropertyNames<T>, unknown][]
  return (m: InstanceType<T>) => {
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

function setMaybeArrayValues<T, K> (
  target: Record<string, unknown>,
  targetKeys: any,
  source: Record<string, unknown>,
  sourceKeys: any
) {
  if (Array.isArray(targetKeys)) {
    targetKeys.forEach((k, index) => {
      target[k] = (source as any)[sourceKeys][index]
    })
  } else {
    target[targetKeys] = (source as any)[sourceKeys]
  }
}

const getValuesFromValues = (target: Record<string, unknown>, primaryKey: KeyName) => {
  return Array.isArray(primaryKey) ? primaryKey.map(k => target[k]) : target[primaryKey]
}

const isAnyOfKeysUndefined = (target: Record<string, unknown>, primaryKey: KeyName) => {
  return Array.isArray(primaryKey) ? primaryKey.some((key) => target[key] === undefined) : target[primaryKey] === undefined
}

export class Model {
  // ['constructor']: typeof Model
  static model = 'Model'

  static isBooted:boolean
  // eslint-disable-next-line no-use-before-define
  static __fields: { [s: string]: () => Field } = {}
  static primaryKey: KeyName = 'id'

  static typeField = 'type'
  static base: string | ctor<Model> | null = null
  static _cache = shallowReactive(new Map())
  static _keyFields = new Map()

  static get cache (): Map<Key, Model> {
    if (this.base) {
      return getModel(this.base).cache
    }

    if (!Object.hasOwnProperty.call(this, '_cache')) {
      this._cache = shallowReactive(new Map())
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

    // In case the static model property is not set, we automatically set it here
    // Otherwise the library breaks
    if (this.model === 'Model' && this !== Model) {
      this.model = this.name
    }

    log && console.log('Booting', this.model)
    modelRegistry.set(this.model, this)
    this.isBooted = true
    return this
  }

  static fields (): { [s: string]: Field } {
    return Object.assign({
      [this.primaryKey as string]: this.uid()
    }, Object.fromEntries(Object.entries(this._fields).map(([ name, fn ]) => [ name, fn() ])))
  }

  static types (): { [s:string]: typeof Model} {
    return {}
  }

  static cascades<T extends typeof Model> (this: T): string[] {
    return []
  }

  static hidden<T extends typeof Model> (this: T): string[] {
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

  // TODO: Optimize with PK
  static whereFirst<T extends typeof Model> (this: T, condition: Partial<Record<PropertyNames<T>, unknown>> | ((m:InstanceType<T>) => boolean)) {
    return ([ ...this.cache.values() ] as InstanceType<T>[]).find(checker(condition)) || null
  }

  static where<T extends typeof Model> (this: T, condition: Partial<Record<PropertyNames<T>, unknown>> | ((m:InstanceType<T>) => boolean)) {
    return ([ ...this.cache.values() ] as InstanceType<T>[]).filter(checker(condition))
  }

  static all<T extends typeof Model> (this: T) {
    return [ ...this.cache.values() ] as InstanceType<T>[]
  }

  static first<T extends typeof Model> (this: T) {
    return this.all()[0]
  }

  static getParentRelation<T extends typeof Model> (this: T, field: Relation, id: Key | Key[]) {

    const otherKey = field.otherKey as PropertyNames<T> | PropertyNames<T>[]

    if (Array.isArray(otherKey)) {

      if (Array.isArray(id)) {

        // If the composite keys match, we can use them
        if (JSON.stringify(otherKey) === JSON.stringify(this.primaryKey)) {
          return this.get(id) as InstanceType<T>
        }

        // Otherwise we have to search through all models
        const condition = otherKey.reduce((acc, curr, index) => {
          acc[curr] = id[index]
          return acc
        }, {} as Record<PropertyNames<T>, Key>)

        return this.whereFirst(condition)

      } else {
        throw new Error('Composite key defined but only single Key given (or other way round)')
      }

    } else if (otherKey !== this.primaryKey as PropertyNames<T>) {

      if (Array.isArray(id)) {
        throw new Error('Composite key defined but only single Key given (or other way round)')
      }

      return this.whereFirst({
        [otherKey]: id
      } as Record<PropertyNames<T>, unknown>)

    } else {
      return this.get(id as Key) as Model
    }
  }

  static getChildRelation<T extends typeof Model> (this: T, field: Relation, id: Key | Key[]) {

    const foreignKey = field.foreignKey as PropertyNames<T> | PropertyNames<T>[]

    if (Array.isArray(foreignKey)) {

      if (Array.isArray(id)) {

        // If the composite keys match, we can use them
        if (JSON.stringify(foreignKey) === JSON.stringify(field.sourceModel.primaryKey)) {
          return this.get(id) as InstanceType<T>
        }

        // Otherwise we have to search through all models
        const condition = foreignKey.reduce((acc, curr, index) => {
          acc[curr] = id[index]
          return acc
        }, {} as Record<PropertyNames<T>, Key>)

        return this.whereFirst(condition)

      } else {
        throw new Error('Composite key defined but only single Key given (or other way round)')
      }

    } else if (foreignKey !== field.sourceModel.primaryKey as PropertyNames<T>) {

      if (Array.isArray(id)) {
        throw new Error('Composite key defined but only single Key given (or other way round)')
      }

      return this.whereFirst({
        [foreignKey]: id
      } as Record<PropertyNames<T>, unknown>)

    } else {
      return this.get(id as PropertyNames<T>)
    }
  }

  get $id (): Key {
    const pKey = this.static().primaryKey
    if (Array.isArray(pKey)) {
      return pKey.map((key) => (this as any)[key]).join(',')
    }

    return (this as any)[pKey]
  }

  _events!: { [s: string]: Set<Callback> }
  _cache!: Record<string, any>
  _foreignKeyCache!: Record<string, any>

  // [key: string]: any

  /**
   * Creates a new instance of the model without saving it to the registry
   * @param values Initial values for the model
   */
  constructor (values: Record<string, unknown> = {}) {
    // eslint-disable-next-line
    // @ts-ignore
    const ctor = this.static()

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

  static<T extends typeof Model> (this: InstanceType<T>): T {
    return this.constructor as T
  }

  /**
   * Creates private events, cache and foreignKeyCache
   */
  _initPrivateProperties (fieldEntries: [string, Field<any>][], values: Record<string, unknown>) {
    const cache = initCache(fieldEntries, values, /* isReactive(values) ? values : */ {})

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
      const ctor = getBaseClass(this.static())
      field.getPivot()._subscribe(ctor, name, field)
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
          (this as any)[name] = rel
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

    return (newVal: Key) => {
      const oldVal = (this as any)[name] as Key | Key[]

      if (newVal === oldVal) return

      // log && console.log('setting field', name, 'to', newVal)

      // If this is a normal field or the instancce is not saved yet
      // just set the value without informing any models
      if (!this.static().keyFields.has(name) || !this.static().cache.has(this.$id)) {
        return setKey(newVal)
      }

      log && console.log('foreignKey', name, 'was set with', newVal)

      // Get subscribers for this field
      const parents = this.static().keyFields.get(name) as Map<typeof Model, [string, Relation]>

      // ?. makes sure that subscriber exists

      // Find old subscriber and remove model from their cache
      parents.forEach(([ nameInParentModel, fieldInParentModel ], Parent) => {
        const subscriber = Parent.getParentRelation(fieldInParentModel, oldVal)
        subscriber?._updateRelationCache(nameInParentModel, fieldInParentModel, DELETE, this)
      })

      // Actually do the change
      setKey(newVal)

      // Find new subscriber and add model to their cache
      parents.forEach(([ nameInParentModel, fieldInParentModel ], Parent) => {
        const subscriber = Parent.getParentRelation(fieldInParentModel, newVal)
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
      if (!local && cache[hash as string] === undefined) {
        log && console.log('Init relation on', this.static().model, hash)
        this._initializeRelation(hash as string, field)
      }

      const ids = (Array.isArray(hash) ? hash.map((h) => cache[h]) : cache[hash]) as Key | Key[]

      const relation = field.resolveRelation(ids)
      return relation
    }
  }

  /* TODO: null values are not processed atm */
  /**
   * Setter factory that creates a setter used when setting a relation of a model
   * @param name The attribute name given in the fields method
   * @param field The Relation object
   * @returns a function which serves as setter for the specified relation
   */
  _setRelationFactory (name: string, field: Relation) {

    return (val: Record<string, unknown> | Record<string, unknown>[]) => {

      const isLocalField = isLocal(field)

      const cache = isLocalField ? this._cache : this._foreignKeyCache
      const hash = isLocalField ? field.foreignKey : name
      const isInitialized = !isAnyOfKeysUndefined(cache, hash as KeyName)

      if (isInitialized && !isLocalField) {
        let currentModels = (this as any)[name] as unknown as Model|Model[]

        if (currentModels) {
          if (!Array.isArray(currentModels)) {
            currentModels = [ currentModels ]
          }

          currentModels.forEach((m) => {
            m.delete()
          })
        }
      }

      if (!val) {
        if (isLocalField) {
          if (field instanceof BelongsTo) {
            ([] as Array<string>).concat(field.foreignKey).forEach(val => {
              ((this as any)[val] as any) = null
            })
          }
        }
        return
      }

      if (!Array.isArray(val)) {
        val = [ val ]
      }

      const models = val.map((v) => {
        if (!isLocalField) {
          setMaybeArrayValues(v, field.foreignKey, this as Record<string, unknown>, this.static().primaryKey)
          // v[field.foreignKey] = this.$id
        }

        if (v instanceof Model) {
          return v.save()
        }

        return field.Type.create(v)
      })

      // We dont have notifications for local models. Therefore we have to set the ids direcly
      const _this = this as any
      if (field instanceof BelongsTo) {
        // _this[field.foreignKey] = models[0].$id
        setMaybeArrayValues(this as Record<string, unknown>, field.foreignKey, models[0], models[0].static().primaryKey)
      } else if (field instanceof HasManyBy) {
        // FIXME: The Set trick doesnt work with composite keys and models are added twice
        const oldIds = (this as any)[field.foreignKey] as unknown as Key[]
        const ids = models.map(m => getValuesFromValues(m, m.static().primaryKey))
        _this[field.foreignKey as string] = [ ...new Set([ ...oldIds, ...ids ]) ]
      }

    }
  }

  /**
   * This method searches for the related models once its first accessed
   * @param name The attribute name given in the fields method
   * @param field The relation object
   */
  _initializeRelation<T extends typeof Model> (this: InstanceType<T>, name: string, field: Relation) {
    // Local relations are already initialized
    if (isLocal(field)) {
      return
    }

    const many = isMany(field)

    const ids = []
    // Loop through all related models and gather ids
    for (const [ id, model ] of field.getPivot().cache as Map<Key, Model>) {
      if (model._getValue(field.foreignKey) === this._getValue(field.otherKey)) {
        ids.push(id)
        if (!many) break
      }
    }

    this._foreignKeyCache[name] = many ? ids : (ids[0] ?? null)
  }

  _getValue (key: KeyName) {
    return Array.isArray(key) ? key.map(k => (this as any)[k]) : (this as any)[key]
  }

  static getPrimaryFromValues (values: Record<string, unknown>): Key {
    if (Array.isArray(this.primaryKey)) {
      return this.primaryKey.map((key) => values[key]).join(',')
    }

    return values[this.primaryKey] as Key
  }

  static joinOrReturn (ids: Key|Key[]) {
    if (Array.isArray(ids)) return ids.toString()
    return ids
  }

  /**
   * Gets one or multiple models by id
   * @param idOrIds An id or array of ids
   */
  static get<T extends typeof Model> (this: T, id: Key): InstanceType<T> | null
  static get<T extends typeof Model> (this: T, ids: (Key)[]): InstanceType<T>[]
  static get<T extends typeof Model> (this: T, idOrIds: (Key)[] | Key): InstanceType<T>[] | InstanceType<T> | null {

    if (Array.isArray(idOrIds) && (!Array.isArray(this.primaryKey) || Array.isArray(idOrIds[0]))) {
      return idOrIds.map((id) => this.cache.get(this.joinOrReturn(id))).filter((a) => a !== undefined) as InstanceType<T>[]
    }

    idOrIds = (Array.isArray(this.primaryKey) ? idOrIds.toString() : idOrIds) as Key
    return this.cache.get(idOrIds) as InstanceType<T> ?? null
  }

  /**
   * Gets one or multiple models by id or creates them if not existent
   * @param idOrIds An id or array of ids
   */
  static getOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>): InstanceType<T>
  static getOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>[]): InstanceType<T>[]
  static getOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>[] | Record<string, unknown>): InstanceType<T>[] | InstanceType<T> {
    const isArray = Array.isArray(values)
    const arr = (isArray ? values : [ values ]) as Record<string, unknown>[]

    const result = arr.map((values) => {
      const id = this.getPrimaryFromValues(values)
      if (this.cache.has(id)) {
        return this.get(id)
      }

      return this.create(values)
    })

    return isArray ? result as InstanceType<T>[] : result[0] as InstanceType<T>
  }

  /**
   * Gets one or multiple models by id or creates them if not existent
   * @param idOrIds An id or array of ids
   */
  static fillOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>): InstanceType<T>
  static fillOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>[]): InstanceType<T>[]
  static fillOrCreate<T extends typeof Model> (this: T, values: Record<string, unknown>[] | Record<string, unknown>): InstanceType<T>[] | InstanceType<T> {
    const isArray = Array.isArray(values)
    const arr = (isArray ? values : [ values ]) as Record<string, unknown>[]

    const result = arr.map((values) => {
      const id = this.getPrimaryFromValues(values)
      if (this.cache.has(id)) {
        return this.get(id)?.fill(values)
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
    log && console.log(Parent.model, 'wants to subscribe to updates on', this.model)

    const foreignKey = Array.isArray(fieldInParentModel.foreignKey)
      ? fieldInParentModel.foreignKey
      : [ fieldInParentModel.foreignKey ]

    foreignKey.forEach((key) => {
      // Get all parents subscribed to this key
      let parents = this.keyFields.get(key)

      // If there is none, initialize it
      if (parents === undefined) {
        parents = new Map<typeof Model, [string, Relation]>()
        this.keyFields.set(key, parents)
      }

      // Add the parent to subscibers
      if (!parents.has(Parent)) {
        parents.set(Parent, [ nameInParentModel, fieldInParentModel ])
      }
    })
  }

  /**
   * Notify all subscribers so they can update their cache
   * @param type Type of change in the Model (ADD / DELETE)
   */
  _notifySubscribers<T extends typeof Model> (this: InstanceType<T>, type: symbol) {
    log && console.log(this.static().model, 'is notifying its dependents with', type)
    this.static().keyFields.forEach((parents, foreignKey) => {
      parents.forEach(([ nameInParentModel, fieldInParentModel ], Parent) => {
        // value of the foreignKey
        // const id = this[foreignKey] as Key

        const fKey = fieldInParentModel.foreignKey as PropertyNames<T> | PropertyNames<T>[]
        const id = Array.isArray(fKey)
          ? fKey.map((key) => this[key])
          : this[fKey]

        // Get the parent model from registry
        const model = Parent.getParentRelation(fieldInParentModel, id as unknown as Key | Key[]) as Model

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
    log && console.log('update cache for', this.static().model, 'notified by', child.static().model, 'local=', isLocal(field), 'fieldname=', name)

    const isMany = field instanceof HasMany
    const cache = this._foreignKeyCache

    // If the cache is undefined, it means the Relation wasnt yet accessed
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
        // Setting it to null makes it possible to check for undefined above
        // But first we have to check, if this id was actually set as its relation
        // If its not set, this is an orphan model which was still linked
        if (cache[name] === child.$id) {
          cache[name] = null
        }
      }

    }
  }

  /**
   * Loops through listeners and calls them
   * @param event Name of the event to be emitted
   * @param data Data to be passed to the event handler
   */
  emit (event: string, ...data: any[]) {
    // runs all listener and returns false if any of the listener returns false
    return [ ...this._events[event] || [] ].reduce((acc, fn) => fn(...data) && acc, true)
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
  delete (beforeDelete?: ((model: Model) => void)) {
    if (this.emit('delete') === false) return this

    beforeDelete?.(this)
    this._triggerCascadeDeletion(beforeDelete)
    this._notifySubscribers(DELETE)
    this.static().cache.delete(this.$id)

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
  toObject<T extends typeof Model> (this: InstanceType<T>, relations?: RelationPropertyNames<T>[]) {
    const obj = Object.assign({}, toRaw(this._cache)) as Properties<T> & RelationProperties<T>

    ;(this.static().hidden() as PropertyNames<T>[]).forEach((field) => {
      delete obj[field]
    })

    if (relations) {
      relations.forEach((field) => {
        const val = this[field] as any
        if (Array.isArray(val)) {
          (obj[field] as any) = val.map(o => o.toObject())
        } else {
          obj[field] = val.toObject()
        }
      })
    }

    return obj
  }

  /**
   * Saves the model in the registry
   */
  save<T extends Model> (this: T) {
    if (this.static().cache.has(this.$id)) {
      const model = (this.static().cache.get(this.$id) as Model)
      if (model === this) return this as T
      // https://github.com/microsoft/TypeScript/issues/13086
      return model.fill(this.toObject()) as T
    }

    this.static().cache.set(this.$id, this)
    this._notifySubscribers(ADD)
    return this as T
  }

  /**
   * Sets multiple attributes at once
   * @param values The values to be bulk set
   */
  fill (values: Record<string, unknown> = {}) {
    // const fieldEntries = Object.entries(this.static().fields())
    // initCache(fieldEntries, Object.assign({}, this._cache, values), this._cache)
    // this._setRelations(fieldEntries, values)

    // const hiddenToUndefined = (arr: string[]) => {
    //   return arr.reduce((acc, curr) => {
    //     acc[curr] = undefined
    //     return acc
    //   }, {} as Record<string, undefined>)
    // }

    Object.assign(this, values/*, hiddenToUndefined(this.static().hidden()) */)

    return this
  }

  _triggerCascadeDeletion (beforeDelete?: ((model: Model) => void)) {
    const cascades = this.static().cascades()

    cascades.forEach((name) => {
      const relation = (this as any)[name] as Model|Model[]|undefined
      if (Array.isArray(relation)) {
        relation.forEach(r => r.delete(beforeDelete))
      } else {
        // Relation doesnt need to be defined
        relation?.delete(beforeDelete)
      }
    })
  }

  clone (relations?: string[]) {
    return this.static().make(this.toObject(relations as any))
  }

  copy<T extends typeof Model> (this: InstanceType<T>, relations?: string[]) {
    const copy = this.toObject()
    const pKey = this.static().primaryKey as PropertyNames<T> | PropertyNames<T>[]
    if (Array.isArray(pKey)) {
      pKey.forEach((key) => {
        delete copy[key]
      })
    } else {
      delete copy[pKey]
    }

    if (relations) {
      (relations as RelationPropertyNames<T>[]).forEach((field) => {
        const val = this[field] as any
        if (Array.isArray(val)) {
          (copy[field] as any) = val.map(o => o.copy())
        } else {
          copy[field] = val.copy()
        }
      })
    }

    return this.static().make(copy)
  }

  dehydrate<T extends typeof Model> (this: InstanceType<T>, relations = this.static().cascades() as RelationPropertyNames<T>[]) {

    const obj = { ...toRaw(this._cache), __class__: this.static().model } as Dehydrate<T> & RelationProperties<T>

    ;(this.static().hidden() as PropertyNames<T>[]).forEach((field) => {
      delete obj[field]
    })

    if (relations) {
      relations.forEach((field) => {
        const val = this[field] as any // RelationProperties<T>[typeof field]
        if (!val) return
        if (Array.isArray(val)) {
          (obj[field] as any) = val.map(o => o.dehydrate())
        } else {
          obj[field] = val.dehydrate()
        }
      })
    }

    return obj
  }

  static hydrate<T extends typeof Model> (this: T, values: Dehydrate<T>) {
    if (!values.__class__) {
      throw new Error('Can not hydrate object without class')
    }

    const Type = getModel(values.__class__ as string) as T

    if (!Type) {
      throw new Error('Model ' + values.__class__ + ' was not found')
    }

    return Type.fillOrCreate(values) as InstanceType<T>
  }
}

// function createCollection (parent: Model, Child: typeof Model, field: Relation) {
//   class Collection extends Array {
//     create (objOrArr: Record<string, unknown> | Record<string, unknown>[]) {
//       const arr = Array.isArray(objOrArr) ? objOrArr : [ objOrArr ]
//       arr.forEach(o => Child.create({ ...o, [field.foreignKey]: parent[field.otherKey] }))
//     }

//     assign (idOrIds: number | string | Array<number|string>) {
//       const ids = Array.isArray(idOrIds) ? idOrIds : [ idOrIds ]

//       ids.forEach((id) => {
//         Child.get(id)![field.foreignKey] = parent[field.otherKey]
//       })
//     }
//   }
// }

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
  isUnique = false
  isPrimary = false
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

  unique (trueOrFalse = true) {
    this.isUnique = trueOrFalse
    return this
  }

  primary (trueOrFalse = true) {
    this.isPrimary = trueOrFalse
    return this
  }

  // getValue (value: unknown) {
  getValue (value: unknown): returnPrimitive<T> | null
  getValue (values:unknown[]): returnPrimitive<T>[] | null
  getValue (value: unknown[] | unknown): returnPrimitive<T> | returnPrimitive<T>[] | null {
    // Only get the default, if the value is non nullable and the value is null or undefined,
    // Or if the value is nullable but the value is undefined
    // That means nullable fields need to be set to null explitely because undefined
    // Will trigger the default. For most of nullable fields, null is the default anyway
    // But sometimes fields can nullable and still have a different default
    return this.sanitize((value == null && !this.isNullable || value === undefined) ? this.getDefault() : value)
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

  sourceModel: ctor<Model>
  foreignKey: KeyName
  otherKey: KeyName
  order: Array<string>| ((a:T, b:T) => number) | null
  declare Type: ctor<T>

  constructor (sourceModel: ctor<Model>, related: ctor<T> | string, foreignKey: KeyName, otherKey: KeyName, defaultValue: unknown = null) {
    if (typeof related === 'string') {
      related = getModel(related)
    }

    super(defaultValue, related)

    this.sourceModel = sourceModel
    this.foreignKey = foreignKey
    this.otherKey = otherKey

    this.order = null
  }

  // Todo: Allow multiply fields
  orderBy (field: string, direction = 'asc') {
    this.order = [ field, direction ]
    return this
  }

  resolveRelation (id: unknown): T | null
  resolveRelation (ids: unknown[]): T[]
  resolveRelation (ids: unknown[]): T[] | T | null {
    // cache, hash
    // if (Array.isArray(this.otherKey) {
    //   if (JSON.stringify(this.foreignKey))
    // }

    const result = this.Type.get(ids)
    if (Array.isArray(this.order)) {
      const [ field, direction ] = this.order as [PropertyNamesInstance<T>, string]
      result.sort((a:T, b:T) => (a[field] < b[field] ? -1 : 1) * (direction === 'asc' ? 1 : -1))
    } else if (typeof this.order === 'function') {
      result.sort(this.order)
    }
    return result ?? null
  }

  /**
   * Queries the related model/s of a relation by its/their foreignKey/s
   * @param id One or more foeign keys of the related Model
   * @returns The Model or Models whose key/keys were passed
   */
  getChildren (id: Key | Key[]) {
    return this.getRelated(id, this.sourceModel.primaryKey)
  }

  /**
   * Queries the parent model/s of a relation by using the foreign keys on the related model
   * @param id One or more foreign keys on the related Model whose parents needs to be found
   * @returns The Model or Models whose key/keys were passed
   */
  getParentFromParentRelationAndForeignKey (id: Key | Key[]) {
    if (Array.isArray(this.otherKey)) {

      // If the composite keys match, we can use them
      if (JSON.stringify(this.otherKey) === JSON.stringify(this.sourceModel.primaryKey)) {
        return this.sourceModel.get(id as Key) as Model
      }

      // Otherwise we have to search through all models
      const condition = this.otherKey.reduce((acc, curr, index) => {
        acc[curr] = (id as Key[])[index]
        return acc
      }, {} as Record<string, Key>)

      return this.sourceModel.whereFirst(condition)

    } else if (this.otherKey !== this.sourceModel.primaryKey) {

      return this.sourceModel.whereFirst({
        [this.otherKey]: id as Key
      })

    } else {
      return this.sourceModel.get(id as Key) as Model
    }
  }

  getParent (id: Key | Key[]) {
    return this.getRelated(id, this.Type.primaryKey)
  }

  getManyRelated (ids: Key[] | Key[][], primaryKey: KeyName) {

    const foreignKey = this.foreignKey

    // Check for composite key
    if (Array.isArray(foreignKey)) {
      ids = ids as Key[][]

      // If composite keys match, we can just get them directly
      // TODO: Unique keys work as well
      if (JSON.stringify(foreignKey) === JSON.stringify(primaryKey)) {
        return this.Type.get(ids) as Model[]
      } else {
        // If they dont match, we have to fallback to regular slow search
        return ids.map(id => {
          const condition = foreignKey.reduce((acc, curr, index) => {
            acc[curr] = id[index]
            return acc
          }, {} as Record<string, Key>)

          return this.Type.whereFirst(condition) as Model
        })
      }
    } else {
      //
    }
  }

  getRelated (id: Key| Key[], primaryKey: KeyName) {
    if (Array.isArray(this.foreignKey)) {

      // If the composite keys match, we can use them
      if (JSON.stringify(this.foreignKey) === JSON.stringify(primaryKey)) {
        return this.Type.get(id as Key) as Model
      }

      // Otherwise we have to search through all models
      const condition = this.foreignKey.reduce((acc, curr, index) => {
        acc[curr] = (id as Key[])[index]
        return acc
      }, {} as Record<string, Key>)

      return this.Type.whereFirst(condition)

    } else if (this.foreignKey !== primaryKey) {

      return this.Type.whereFirst({
        [this.foreignKey]: id as Key
      })

    } else {
      return this.Type.get(id as Key) as Model
    }
  }

  getPivot (): ctor<Model> {
    return this.Type
  }
}

export class HasOne<T extends Model> extends Relation<T> {
  // resolveRelation (id: Key[]) {
  //   return this.getChildren(id)
  // }
}

export class BelongsTo<T extends Model> extends Relation<T> {
  // resolveRelation (id: Key[]) {
  //   return this.getParent(id)
  // }
}

export class HasMany<T extends Model> extends Relation<T> {
  constructor (sourceModel: ctor<Model>, related: ctor<T> | string, foreignKey: KeyName, otherKey: KeyName, defaultValue = []) {
    super(sourceModel, related, foreignKey, otherKey, [])
  }

  // resolveRelation (id: Key[]) {
  //   return this.getChildren(id)
  // }
}

export class HasManyBy<T extends Model> extends Relation<T> {
  // FIXME
  declare foreignKey: string

  constructor (sourceModel: ctor<Model>, related: ctor<T> | string, foreignKey: KeyName, otherKey: KeyName, defaultValue = []) {
    super(sourceModel, related, foreignKey, otherKey, [])
  }

  // resolveRelation (id: Key[][] | Key[]) {
  //   const otherKey = this.otherKey
  //   if (JSON.stringify(otherKey) === JSON.stringify(this.Type.primaryKey)) {
  //     return this.Type.get(id)
  //   } else {
  //     if (Array.isArray(otherKey)) {
  //       return (id as Key[][]).map((id) => {
  //         const condition = otherKey.reduce((acc, curr, index) => {
  //           acc[curr] = id[index]
  //           return acc
  //         }, {} as Record<string, Key>)
  //         return this.Type.whereFirst(condition)
  //       })
  //     } else {
  //       return this.Type.where((m:Model) => (id as Key[]).includes(m.$id))
  //     }
  //   }
  // }
}

export class BelongsToMany<T extends Model> extends Relation<T> {
  pivot: ctor<Model>
  foreignKey2: KeyName
  otherKey2: KeyName
  constructor (sourceModel: ctor<Model>, related: ctor<T>, pivot: ctor<Model>, foreignKey1: KeyName, foreignKey2: KeyName, otherKey1: KeyName, otherKey2: KeyName, defaultValue = []) {
    super(sourceModel, related, foreignKey1, otherKey1, [])
    this.pivot = pivot
    this.foreignKey2 = foreignKey2
    this.otherKey2 = otherKey2
  }

  resolveRelation (ids: unknown[]): T[]
  resolveRelation (id: unknown): never
  resolveRelation (ids: unknown[]): T[] {
    return this.pivot.get(ids).map((p: Model) => (p as any)[camelCase(this.Type.model)])
  }

  getPivot () {
    return this.pivot
  }
}

export class ComputedField<K, T extends unknown = unknown> extends Field<T> {
  computedValue!: ComputedRef<T>
  value!: T
  getter: (context: K) => T
  setter: (context: K, value: any) => void

  constructor (getter: (context: K) => T, setter: (context: K, value: any) => void) {
    super(null)
    this.getter = getter
    this.setter = setter
  }

  createComputed (context: K) {
    this.computedValue = computed<T>(() => this.getter(context))
    Object.defineProperty(this, 'value', {
      get () { return this.computedValue.value },
      set (val) { this.setter(context, val) }
    })
    return this
  }
}

export const modelRegistry = new Map<string, typeof Model>()

export const isLocal = (inst: Relation) => inst instanceof BelongsTo || inst instanceof HasManyBy
export const isMany = (inst: Relation) => inst instanceof HasMany || inst instanceof HasManyBy || inst instanceof BelongsToMany

export const setLogging = (enable: boolean) => {
  log = enable
}

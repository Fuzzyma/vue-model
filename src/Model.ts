// todo:
//  - allow to access pivot table from either side of belongsToMany
//  - allow renaming pivot to whatever fits better e.g. subscriptions
//  - allow hasManyThrough

/* eslint-disable no-wrapper-object-types */
import { computed as vueComputed, reactive, shallowReactive, toRaw, type WritableComputedRef } from '@vue/reactivity';

export const ADD = Symbol('ADD');
export const DELETE = Symbol('DELETE');

export function assert(condition: boolean | object | string | undefined | null, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Assertion failed');
  }
}

type Callback = (...data: any[]) => any;

export type OmitPrivate<T extends Model> = Omit<T, '_events' | '_cache' | '_foreignKeyCache' | '$id'>;

export type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

export type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;
export type Properties<T extends Model> = NonFunctionProperties<OmitPrivate<T>>;

export type ToObject<T extends Model> = {
  [Props in keyof Properties<T>]: T[Props] extends Model ? ToObject<T[Props]> : T[Props] extends (infer U)[] ? (U extends Model ? ToObject<U>[] : T[Props]) : T[Props];
};

export type PartialToObject<T extends Model> = Partial<{
  [Props in keyof Properties<T>]: T[Props] extends Model | null
    ? PartialToObject<NonNullable<T[Props]>> | null
    : T[Props] extends (infer U)[]
    ? U extends Model
      ? PartialToObject<U>[]
      : T[Props]
    : T[Props];
}>;

export type Dehydrate<T extends Model> = {
  [Props in keyof Properties<T>]: T[Props] extends Model | null ? Dehydrate<NonNullable<T[Props]>> | null : T[Props] extends (infer U)[] ? (U extends Model ? Dehydrate<U>[] : T[Props]) : T[Props];
} & { __class__: string };

export type PropertyNames<T extends Model> = keyof Properties<T>;

export type RelationProperties<T extends Model> = {
  [Props in keyof Properties<T>]: T[Props] extends Model | Model[] ? T[Props] : never;
};

export type RelationPropertyNames<T extends Model> = keyof RelationProperties<T>;

export type NormalProperties<T extends Model> = Omit<Properties<T>, RelationPropertyNames<T>>;

const uuid = () => (Math.random() * 10000000).toString(16);

let log = false;

type ctor<T = any, A extends any = any> = {
  new (...args: [A]): T;
};

export type Key = number | string | symbol;
export type CompositeKey = Key[];
type KeyName = string | string[];

export type Fields = { [s: string]: Field<any, any, any> };

export type InferFieldTypeWithDefault<T extends Field<any, any, any>> = T extends Field<any, any, infer _K extends {} | undefined>
  ? T['TType'] | undefined
  : T extends Field<any, any, infer _K extends null | undefined>
  ? T['TType'] | undefined
  : T['TType'];

export type InferFieldType<T extends Field<any, any, any>> = T['TType'];

export type InferTypeFromFields<T extends Fields> = {
  [P in keyof T]: InferFieldType<T[P]>;
};
export type InferTypeFromFieldsWithDefaults<T extends Fields> = {
  [P in keyof T]: InferFieldTypeWithDefault<T[P]>;
};

function getModel<T extends typeof Model = typeof Model>(model: T | string): T;
function getModel<T extends typeof Model = typeof Model>(model: T | string | undefined): T;
function getModel<T extends typeof Model = typeof Model>(model: T | string | undefined): T {
  const ret = typeof model === 'string' ? (modelRegistry.get(model) as T) : model;
  if (!ret) throw new Error('Couldnt find model ' + model + ' in modelRegistry. Is it imported and booted?');
  return ret;
}

function getPivotModel<T extends typeof Model, S extends typeof Model>(model1: S | string, model2: T | string, foreignKey1: KeyName, foreignKey2: KeyName, otherKey1: KeyName, otherKey2: KeyName) {
  const model1Class = getModel(model1);
  const model2Class = getModel(model2);

  const name = [model1Class.model, model2Class.model].sort().join('_');

  if (modelRegistry.has(name)) {
    return modelRegistry.get(name);
  }

  const arrayKey1 = Array.isArray(foreignKey1) ? foreignKey1 : [foreignKey1];
  const arrayKey2 = Array.isArray(foreignKey2) ? foreignKey2 : [foreignKey2];

  console.log(foreignKey1, foreignKey2);

  const fields1 = arrayKey1.reduce((acc, curr) => {
    acc[curr] = createString(null);
    return acc;
  }, {} as Record<string, Field<any, any, any>>);

  const fields2 = arrayKey2.reduce((acc, curr) => {
    acc[curr] = createString(null);
    return acc;
  }, {} as Record<string, Field<any, any, any>>);

  return class extends Model {
    static override model = name;
    static override fields() {
      return {
        id: this.uid(),
        ...fields1,
        ...fields2,
        model1: this.belongsTo(model1Class, foreignKey1, otherKey1),
        model2: this.belongsTo(model2Class, foreignKey2, otherKey2),
      } as { [s: string]: Field<any> };
    }
  }.boot();
}

// export function prop<T extends (...args: any[]) => Field<any, any, any>>(fn: T, nullable: boolean, ...args: any[]) {
//   return (target: Model, propertyKey: string) => {
//     target.static()._fields[propertyKey] = () => fn.apply(Model, args).nullable(nullable);
//   };
// }

export const prop = <T extends (...args: any[]) => Field<any, any, any>>(
  fn: T,
  { defaultValue, nullable = defaultValue === null ? true : false, factory }: { defaultValue?: any; nullable?: boolean; factory?: any } = {},
) => {
  return <T extends Model>(target: T, propertyKey: string) => {
    target.static().decorated[propertyKey] = () => fn.call(Model, defaultValue, factory).nullable(nullable);
  };
};

export const relation = <T extends (...args: any[]) => Field<any, any, any>>(fn: T, ...args: any[]) => {
  return <T extends Model>(target: T, propertyKey: string) => {
    target.static().decorated[propertyKey] = () => fn.apply(Model, args);
  };
};

function createNumber(): Field<number>;
function createNumber<T extends unknown>(defaultValue: T): Field<number, false, T>;
function createNumber<T extends unknown>(defaultValue?: T) {
  return new Field(defaultValue, (val) => Number(val));
}

function createString(): Field<string>;
function createString<T extends unknown>(defaultValue: T): Field<string, false, T>;
function createString<T extends unknown>(defaultValue?: T) {
  return new Field(defaultValue, (val) => String(val));
}

function createBoolean(): Field<boolean>;
function createBoolean<T extends unknown>(defaultValue: T): Field<boolean, false, T>;
function createBoolean<T extends unknown>(defaultValue?: T) {
  return new Field(defaultValue, (val) => Boolean(val));
}

function createArray<T extends unknown>(defaultValue: T[] = []) {
  return new Field<T, true, T[]>(defaultValue ?? [], (arg: T) => arg);
}

type ToPrimitive<T> = T extends string | String ? string : T extends number | Number ? number : T extends boolean | Boolean ? boolean : T;

function createField(): Field<unknown, false, unknown>;
function createField<T extends unknown>(defaultValue: T): Field<T, false, T>;
function createField<T extends unknown, K extends unknown>(defaultValue: K, ctor: ctor<T, K | T>): Field<ToPrimitive<T>, false, T>;
function createField<T extends unknown, K extends unknown>(defaultValue: K, factory: (arg: any) => T): Field<ToPrimitive<T>, false, T>;
function createField(defaultValue: any = {}, ctorOrFn?: any) {
  return new Field(defaultValue, ctorOrFn);
}

function createUid() {
  return createString(uuid);
}

function createComputed<T, K>(this: ctor<K>, getter: (context: K) => T, setter = (_context: K, _val: any) => {}) {
  return new ComputedField(getter, setter);
}

export function computer<T, K extends Fields>(fields: K, getter: (context: InferTypeFromFields<K>) => T, setter = (_context: InferTypeFromFields<K>, _val: any) => {}) {
  return new ComputedField(getter, setter);
}

function createHasOne<T extends typeof Model, S extends typeof Model>(this: S, related: T | string, foreignKey?: KeyName, otherKey?: KeyName) {
  return new HasOne(this.boot(), getModel(related).boot(), foreignKey ?? camelCase(this.model) + 'Id', otherKey ?? this.primaryKey);
}

function createHasMany<T extends typeof Model, S extends typeof Model>(this: S, related: T | string, foreignKey?: KeyName, otherKey?: KeyName) {
  return new HasMany(this.boot(), getModel(related).boot(), foreignKey ?? camelCase(this.model) + 'Id', otherKey ?? this.primaryKey);
}

function createHasManyBy<T extends typeof Model, S extends typeof Model>(this: S, related: T | string, foreignKey?: KeyName, otherKey?: KeyName) {
  related = getModel(related);
  return new HasManyBy(this.boot(), related.boot(), foreignKey ?? camelCase(related.model) + 'Ids', otherKey ?? related.primaryKey);
}

function createBelongsTo<T extends typeof Model, S extends typeof Model>(this: S, related: T | string, foreignKey?: KeyName, otherKey?: KeyName) {
  related = getModel(related);
  return new BelongsTo(this.boot(), related.boot(), foreignKey ?? camelCase(related.model) + 'Id', otherKey ?? related.primaryKey);
}

function createBelongsToMany<T extends typeof Model, S extends typeof Model, P extends typeof Model>(
  this: S,
  related: T | string,
  pivot?: P,
  foreignKey1?: KeyName,
  foreignKey2?: KeyName,
  otherKey1?: KeyName,
  otherKey2?: KeyName,
) {
  this.boot();
  related = getModel(related).boot();
  foreignKey1 ??= 'model1Id';
  foreignKey2 ??= 'model2Id';
  otherKey1 ??= this.primaryKey;
  otherKey2 ??= related.primaryKey;
  pivot ??= getPivotModel(this, related, foreignKey1, foreignKey2, otherKey1, otherKey2) as P;
  return new BelongsToMany(this, related, pivot.boot(), foreignKey1, foreignKey2, otherKey1, otherKey2);
}

export function number(defaultValue?: any, nullable?: boolean) {
  return prop(createNumber, { defaultValue, nullable });
}

export function string(defaultValue?: any, nullable?: boolean) {
  return prop(createString, { defaultValue, nullable });
}

export function boolean(defaultValue?: any, nullable?: boolean) {
  return prop(createBoolean, { defaultValue, nullable });
}

export function array(defaultValue = [], nullable?: boolean) {
  return prop(createArray, { defaultValue, nullable });
}

export function field(defaultValue?: any, nullable?: boolean, factory: ctor<any> | ((arg: any) => any) = Object) {
  return prop(createField, { defaultValue, nullable, factory });
}

export function uid() {
  return prop(createUid);
}

export function hasOne(related: ctor<Model> | string, foreignKey?: KeyName, otherKey?: KeyName) {
  return relation(createHasOne, related, foreignKey, otherKey);
}

export function hasMany(related: ctor<Model> | string, foreignKey?: KeyName, otherKey?: KeyName) {
  return relation(createHasMany, related, foreignKey, otherKey);
}

export function hasManyBy(related: ctor<Model> | string, foreignKey?: KeyName, otherKey?: KeyName) {
  return relation(createHasManyBy, related, foreignKey, otherKey);
}

export function belongsTo(related: ctor<Model> | string, foreignKey?: KeyName, otherKey?: KeyName) {
  return relation(createBelongsTo, related, foreignKey, otherKey);
}

export function belongsToMany(related: ctor<Model> | string, pivot?: ctor<Model>, foreignKey1?: KeyName, foreignKey2?: KeyName, otherKey1?: KeyName, otherKey2?: KeyName) {
  return relation(createBelongsToMany, related, pivot, foreignKey1, foreignKey2, otherKey1, otherKey2);
}

export function computed<T, K extends Model>(getter: (context: K) => T, setter = (_context: K, _val: any) => {}) {
  return (target: K, propertyKey: string) => {
    // @ts-expect-error
    target.static().decorated[propertyKey] = () => createComputed(getter, setter);
  };
}

const filterRelation = (fields: [string, Field<any>][]) => fields.filter(([_name, field]) => field instanceof Relation && !isLocal(field)) as [string, Relation][];

const initCache = (fields: [string, Field<any>][], values: Record<string, unknown>, cache: Record<string, unknown> = {}) =>
  fields.reduce((cache, [name, field]) => {
    if (!(field instanceof Relation) && !(field instanceof ComputedField)) {
      cache[name] = field.getValue(values[name]);
    }
    return cache;
  }, cache);

function checker<T extends Model>(conditions: Partial<Record<PropertyNames<T>, unknown>> | ((m: T) => boolean)) {
  if (typeof conditions === 'function') return conditions;

  const entries = Object.entries(conditions) as [PropertyNames<T>, unknown][];
  return (m: T) => {
    let ret = true;
    for (const [key, value] of entries) {
      ret = ret && m[key] === value;
      if (!ret) break;
    }

    return ret;
  };
}

export const getBaseClass = (type: string | typeof Model) => {
  let Type = getModel(type);
  while (Type.base) {
    Type = getModel(Type.base);
  }
  return Type;
};

function setMaybeArrayValues(target: any, targetKeys: any, source: any, sourceKeys: any) {
  if (Array.isArray(targetKeys)) {
    targetKeys.forEach((k, index) => {
      target[k] = (source as any)[sourceKeys][index];
    });
  } else {
    target[targetKeys] = (source as any)[sourceKeys];
  }
}

const getValuesByKeys = (target: object, primaryKey: KeyName) => {
  // @ts-expect-error we know that all keys can be found in target
  return Array.isArray(primaryKey) ? primaryKey.map((k) => target[k]) : target[primaryKey];
};

const isAnyOfKeysUndefined = (target: Record<string, unknown>, primaryKey: KeyName) => {
  return Array.isArray(primaryKey) ? primaryKey.some((key) => target[key] === undefined) : target[primaryKey] === undefined;
};

type DecideKey<T extends typeof Model> = T['primaryKey'] extends any[] ? CompositeKey : Key;

export class Model {
  static model = 'Model';

  declare ['constructor']: typeof Model;

  static isBooted: boolean;
  static primaryKey: KeyName = 'id';

  static typeField = 'type';
  static base: string | typeof Model | null = null;
  static _cache = shallowReactive(new Map());
  static _keyFields = new Map();
  static _decorated: { [s: string]: () => Field<any, any, any> } = {};

  static get cache(): Map<Key, Model> {
    if (this.base) {
      return getModel(this.base).cache;
    }

    if (!Object.hasOwnProperty.call(this, '_cache')) {
      this._cache = shallowReactive(new Map());
    }
    return this._cache;
  }

  static get keyFields(): Map<string, Map<typeof Model, [string, AnyRelation]>> {
    if (this.base) {
      return getModel(this.base).keyFields;
    }

    if (!Object.hasOwnProperty.call(this, '_keyFields')) {
      this._keyFields = new Map();
    }
    return this._keyFields;
  }

  static get decorated() {
    if (!Object.hasOwnProperty.call(this, '_decorated')) {
      this._decorated = {};
    }
    return this._decorated;
  }

  static boot<T extends typeof Model>(this: T): T {
    if (Object.hasOwnProperty.call(this, 'isBooted')) {
      return this;
    }

    if (this.base) getModel(this.base).boot();

    // In case the static model property is not set, we automatically set it here
    // Otherwise the library breaks
    if (this.model === 'Model' && this !== Model) {
      this.model = this.name;
    }

    log && console.log('Booting', this.model);
    modelRegistry.set(this.model, this);
    this.isBooted = true;
    return this;
  }

  static fields(): { [s: string]: Field<any, any, any> } {
    return {};
  }

  static getFields() {
    const fields = this.fields();

    // add fields that were added through decorators
    Object.keys(this.decorated).forEach((key) => {
      if (!(key in fields)) {
        fields[key] = this.decorated[key]!();
      }
    });

    // add primary keys if not present
    const primaryKeys = Array.isArray(this.primaryKey) ? this.primaryKey : [this.primaryKey];
    primaryKeys.forEach((key) => {
      if (!(key in fields)) {
        fields[key] = this.uid();
      }
    });

    return fields;
  }

  static types(): { [s: string]: typeof Model } {
    return {};
  }

  static cascades(): string[] {
    return [];
  }

  static hidden(): string[] {
    return [];
  }

  static number = createNumber;
  static string = createString;
  static boolean = createBoolean;
  static array = createArray;
  static field = createField;
  static uid = createUid;
  static computed = createComputed;
  static hasOne = createHasOne;
  static hasMany = createHasMany;
  static hasManyBy = createHasManyBy;
  static belongsTo = createBelongsTo;
  static belongsToMany = createBelongsToMany;

  // TODO: Optimize with PK
  static whereFirst<T extends typeof Model>(this: T, condition: Partial<Record<PropertyNames<InstanceType<T>>, unknown>> | ((m: InstanceType<T>) => boolean)) {
    return ([...this.cache.values()] as InstanceType<T>[]).find(checker(condition)) || null;
  }

  static where<T extends typeof Model>(this: T, condition: Partial<Record<PropertyNames<InstanceType<T>>, unknown>> | ((m: InstanceType<T>) => boolean)) {
    return ([...this.cache.values()] as InstanceType<T>[]).filter(checker(condition));
  }

  static all<T extends typeof Model>(this: T) {
    return [...this.cache.values()] as InstanceType<T>[];
  }

  static first<T extends typeof Model>(this: T) {
    return this.all()[0];
  }

  static getParentRelation<T extends typeof Model>(this: T, field: AnyRelation, id: DecideKey<T>) {
    const otherKey = field.otherKey as PropertyNames<InstanceType<T>> | PropertyNames<InstanceType<T>>[];

    if (Array.isArray(otherKey)) {
      assert(Array.isArray(id), 'Composite key defined but only single Key given');

      // If the composite keys match, we can use them
      if (JSON.stringify(otherKey) === JSON.stringify(this.primaryKey)) {
        return this.get(id);
      }

      // Otherwise we have to search through all models
      const condition = otherKey.reduce((acc, curr, index) => {
        acc[curr] = id[index]!;
        return acc;
      }, {} as Record<PropertyNames<InstanceType<T>>, Key>);

      return this.whereFirst(condition);
    } else if (otherKey !== (this.primaryKey as PropertyNames<InstanceType<T>>)) {
      assert(!Array.isArray(id), 'Composite key defined but only single Key given');

      return this.whereFirst({
        [otherKey]: id,
      } as Record<PropertyNames<InstanceType<T>>, unknown>);
    } else {
      return this.get(id);
    }
  }

  static getChildRelation<T extends typeof Model>(this: T, field: AnyRelation, id: DecideKey<T>) {
    const foreignKey = field.foreignKey as PropertyNames<InstanceType<T>> | PropertyNames<InstanceType<T>>[];

    if (Array.isArray(foreignKey)) {
      if (Array.isArray(id)) {
        // If the composite keys match, we can use them
        if (JSON.stringify(foreignKey) === JSON.stringify(field.sourceModel.primaryKey)) {
          return this.get(id) as InstanceType<T>;
        }

        // Otherwise we have to search through all models
        const condition = foreignKey.reduce((acc, curr, index) => {
          // TODO: If this is false, what is wrong? This check was only added for typescript and unchecked index access
          // Maybe use assert instead
          if (id[index]) {
            acc[curr] = id[index];
          }
          return acc;
        }, {} as Record<PropertyNames<InstanceType<T>>, Key>);

        return this.whereFirst(condition);
      } else {
        throw new Error('Composite key defined but only single Key given (or other way round)');
      }
    } else if (foreignKey !== (field.sourceModel.primaryKey as PropertyNames<InstanceType<T>>)) {
      if (Array.isArray(id)) {
        throw new Error('Composite key defined but only single Key given (or other way round)');
      }

      return this.whereFirst({
        [foreignKey]: id,
      } as Record<PropertyNames<InstanceType<T>>, unknown>);
    } else {
      return this.get(id);
    }
  }

  get $id(): Key {
    const pKey = this.static().primaryKey;
    if (Array.isArray(pKey)) {
      return pKey.map((key) => (this as any)[key]).join(',');
    }

    return (this as any)[pKey];
  }

  _events!: { [s: string]: Set<Callback> };
  _cache!: Record<string, any>;
  _foreignKeyCache!: Record<string, any>;

  // [key: string]: any

  /**
   * Creates a new instance of the model without saving it to the registry
   * @param values Initial values for the model
   */
  constructor(values: Record<string, unknown> = {}) {
    const ctor = this.static().boot();

    const types = ctor.types();

    // Make sure that the type for any created model is correct
    if (values[ctor.typeField] && types[values[ctor.typeField] as string] !== ctor) {
      const Model = getModel(types[values[ctor.typeField] as string]);
      return new Model(values);
    }

    const fieldEntries = Object.entries(ctor.getFields());

    this._initPrivateProperties(fieldEntries, values);
    this._observeRelations(fieldEntries);
    this._initFields(fieldEntries);
    this._setRelations(fieldEntries, values as Record<string, Record<string, unknown> | undefined>);
  }

  static<T extends typeof Model>(this: InstanceType<T>): T {
    return this.constructor as T;
  }

  /**
   * Creates private events, cache and foreignKeyCache
   */
  _initPrivateProperties(fieldEntries: [string, Field<any>][], values: Record<string, unknown>) {
    const cache = initCache(fieldEntries, values, /* isReactive(values) ? values : */ {});

    Object.defineProperties(this, {
      _events: {
        enumerable: false,
        value: {},
      },
      _cache: {
        enumerable: false,
        value: reactive(cache),
      },
      _foreignKeyCache: {
        enumerable: false,
        value: reactive({}),
      },
    });
  }

  /**
   * Collect all relations of this model and subscribe to changes of them
   */
  _observeRelations(fieldEntries: [string, Field<any>][]) {
    const relations = filterRelation(fieldEntries);

    // make sure this model is informed when a related model was created
    // so we can add it to the corresponding cache array
    relations.forEach(([name, field]) => {
      const ctor = getBaseClass(this.static());
      field.getPivot()._subscribe(ctor, name, field);
    });
  }

  /**
   * Create getter for all fields
   */
  _initFields(fieldEntries: [string, Field<any>][]) {
    fieldEntries.forEach(([name, field]) => {
      if (field instanceof Relation) {
        const comp = vueComputed<any>({
          get: this._getRelationFactory(name, field).bind(this),
          set: this._setRelationFactory(name, field).bind(this),
        });

        // Getters and setters for relations
        Object.defineProperty(this, name, {
          get() {
            return comp.value;
          },
          set(val) {
            comp.value = val;
          },
          enumerable: true,
        });
      } else if (field instanceof ComputedField) {
        // Getters and setters for computed fields
        field.createComputed(this);
        Object.defineProperty(this, name, {
          get() {
            return field.value.value;
          },
          set(val) {
            field.value.value = val;
          },
          enumerable: true,
        });
      } else {
        // Getters and setters for "key" attributes and normal ones
        Object.defineProperty(this, name, {
          get: this._getAttrFactory(name, field),
          set: this._setKeyFactory(name, field),
          enumerable: true,
        });
      }
    });
  }

  /**
   * Assigns relations by creating the related Models if needed and setting the corresponding keys
   * by assigning it via relation setter
   * @fieldEntries [string, Field<any>][] The fields of the model
   * @values Record<string, unknown> The values for each field
   */
  _setRelations(fieldEntries: [string, Field<any>][], values: Record<string, Record<string, unknown> | undefined>) {
    fieldEntries.forEach(([name, field]) => {
      // Skip all fields that are not relations
      if (!(field instanceof Relation)) return;

      const relationData = values[name];

      // If there are no values given for this field, it stays unititialized
      if (!relationData) return;

      // Need this cast. Otherwise field is of type Relation<any, any>
      const relation = field as Relation;

      const models = relation.Type.fillOrCreate(relationData);
      (this as any)[name] = models;

      // // TODO: Check if model exists before creating it
      // // Any value passed into getValue gets converted to the type of the Relation
      // const rel = (field as Relation).getValue(relationData) as Model | Array<Model | null>;

      // // Save the created model
      // if (Array.isArray(rel)) {
      //   rel.forEach((model) => model && model.save());
      // } else {
      //   rel.save();
      // }

      // // Set the relation on the parent
      // (this as any)[name] = rel;
    });
  }

  /**
   * Getter factory which returns a getter used when accessing attributes
   * @param name The attribute name given in the fields method
   * @param field The field object
   * @returns a function which serves as getter for the specified attribute
   */
  _getAttrFactory(name: string, _field: Field<any>) {
    return () => this._cache[name];
  }

  /**
   * Setter factory which returns a setter used when accessing attributes
   * @param name The attribute name given in the fields method
   * @param field The field object
   * @returns a function which serves as setter for the specified attribute
   */
  _setAttrFactory(name: string, field: Field<any>) {
    return (val: any) => {
      this._cache[name] = field.getValue(val); // .valueOf()
    };
  }

  /**
   * When a field is set whose content is the foreignKey for another model (or models),
   * we have to make sure that the other model is notified that the relation just broke
   * and a new other model must be notified that a relation was added */
  _setKeyFactory<T extends typeof Model>(this: InstanceType<T>, name: string, field: Field<any>) {
    const setKey = this._setAttrFactory(name, field);

    return (newVal: DecideKey<T>) => {
      const oldVal = this[name as PropertyNames<InstanceType<T>>] as DecideKey<T>;

      if (JSON.stringify(newVal) === JSON.stringify(oldVal)) return;

      // log && console.log('setting field', name, 'to', newVal)

      // If this is a normal field or the instancce is not saved yet
      // just set the value without informing any models
      if (!this.static().keyFields.has(name) || !this.static().cache.has(this.$id)) {
        return setKey(newVal);
      }

      log && console.log('foreignKey', name, 'was set with', newVal);

      // Get subscribers for this field
      const parents = this.static().keyFields.get(name) as Map<typeof Model, [string, AnyRelation]>;

      // ?. makes sure that subscriber exists

      // Find old subscriber and remove model from their cache
      parents.forEach(([nameInParentModel, fieldInParentModel], Parent) => {
        const subscriber = Parent.getParentRelation<any>(fieldInParentModel, oldVal);
        subscriber?._updateRelationCache(nameInParentModel, fieldInParentModel, DELETE, this);
      });

      // Actually do the change
      setKey(newVal);

      // Find new subscriber and add model to their cache
      parents.forEach(([nameInParentModel, fieldInParentModel], Parent) => {
        const subscriber = Parent.getParentRelation<any>(fieldInParentModel, newVal);
        subscriber?._updateRelationCache(nameInParentModel, fieldInParentModel, ADD, this);
      });
    };
  }

  /**
   * Getter factory that creates a getter used when accessing a relation of a model
   * @param name The attribute name given in the fields method
   * @param field The Relation object
   * @returns a function which serves as getter for the specified relation
   */
  _getRelationFactory<T extends typeof Model>(this: InstanceType<T>, name: string, field: AnyRelation) {
    const local = isLocal(field);
    const cache = local ? this._cache : this._foreignKeyCache;
    const hash = local ? field.foreignKey : name;

    return () => {
      // This is only ever executed on non-local relations because
      // the _cache (where the local relations keys live) is always already initialized
      if (!local && cache[hash as string] === undefined) {
        log && console.log('Init relation on', this.static().model, hash);
        this._initializeRelation(hash as string, field);
      }

      // This is null in case the relation was initialized but the related model doesnt exist
      const ids = (Array.isArray(hash) ? hash.map((h) => cache[h]) : cache[hash]) as DecideKey<T> | DecideKey<T>[] | null;

      if (ids == null) return null;

      // This is for the exception that a composite key is used in a many relation and no related model was found
      // In that case, ids is just [] and that results in Model.get thinking that a single wrong composite key was passed
      // thus returning null. However, in cases like that we obviously want an emoty array to be returned
      if (Array.isArray(ids) && ids.length === 0 && Array.isArray(field.otherKey)) {
        return [];
      }

      // @ts-expect-error typescript types resolveRelation wrong
      const relation = field.resolveRelation(ids);
      return relation;
    };
  }

  /* TODO: null values are not processed atm */
  /**
   * Setter factory that creates a setter used when setting a relation of a model
   * @param name The attribute name given in the fields method
   * @param field The Relation object
   * @returns a function which serves as setter for the specified relation
   */
  _setRelationFactory(name: string, field: AnyRelation) {
    return (val: Record<string, unknown> | Record<string, unknown>[]) => {
      const isLocalField = isLocal(field);

      const cache = isLocalField ? this._cache : this._foreignKeyCache;
      const hash = isLocalField ? field.foreignKey : name;
      const isInitialized = !isAnyOfKeysUndefined(cache, hash as KeyName);

      // If this relation is initialized and is not local, we delete all models before setting the new ones
      // FIXME: This might be expensive. Maybe we could update the ones that already exist instead
      if (isInitialized && !isLocalField) {
        let currentModels = (this as any)[name] as unknown as Model | Model[] | undefined;

        if (currentModels) {
          if (!Array.isArray(currentModels)) {
            currentModels = [currentModels];
          }

          currentModels.forEach((m) => {
            m.delete();
          });
        }
      }

      if (!val) {
        if (field instanceof BelongsTo) {
          [field.foreignKey].flat().forEach((val) => {
            (this as any)[val] = null;
          });
        }
        return;
      }

      val = Array.isArray(val) ? val : [val];

      const models = val.map((v) => {
        if (!isLocalField) {
          setMaybeArrayValues(v, field.foreignKey, this, field.otherKey);
        }

        if (v instanceof Model) {
          return v.save();
        }

        return field.Type.create(v);
      });

      // We dont have notifications for local models. Therefore we have to set the ids direcly
      const _this = this as any;
      if (field instanceof BelongsTo) {
        // _this[field.foreignKey] = models[0].$id
        setMaybeArrayValues(this, field.foreignKey, models[0], models[0]!.static().primaryKey);
      } else if (field instanceof HasManyBy) {
        // FIXME: The Set trick doesnt work with composite keys and models are added twice
        const oldIds = (this as any)[field.foreignKey] as unknown as Key[];
        const ids = models.map((m) => getValuesByKeys(m, m.static().primaryKey));
        _this[field.foreignKey as string] = [...new Set([...oldIds, ...ids])];
      }
    };
  }

  /**
   * This method searches for the related models once its first accessed
   * @param name The attribute name given in the fields method
   * @param field The relation object
   */
  _initializeRelation<T extends typeof Model>(this: InstanceType<T>, name: string, field: AnyRelation) {
    // Local relations are already initialized
    if (isLocal(field)) {
      return;
    }

    const many = isMany(field);

    const ids = [];
    // Loop through all related models and gather ids
    for (const [_id, model] of field.getPivot().cache as Map<Key, Model>) {
      if (JSON.stringify(model._getValue(field.foreignKey)) === JSON.stringify(this._getValue(field.otherKey))) {
        // ids.push(id);
        // we cannot push id directly because in case of composite keys, its already stringified.
        // However, we want to cache the array of keys and not the stringified version
        ids.push(model._getValue(model.static().primaryKey));
        if (!many) break;
      }
    }

    this._foreignKeyCache[name] = many ? ids : ids[0] ?? null;
  }

  _getValue(key: KeyName) {
    return Array.isArray(key) ? key.map((k) => (this as any)[k]) : (this as any)[key];
  }

  static getPrimaryFromValues<T extends typeof Model>(this: T, values: Record<string, unknown>): DecideKey<T> {
    if (Array.isArray(this.primaryKey)) {
      return this.primaryKey.map((key) => values[key]) as DecideKey<T>;
    }

    return values[this.primaryKey] as DecideKey<T>;
  }

  static joinOrReturn(ids: Key | Key[]) {
    if (Array.isArray(ids)) return ids.toString();
    return ids;
  }

  /**
   * Gets one or multiple models by id
   * @param idOrIds An id or array of ids
   */
  static get<T extends typeof Model>(this: T, id: DecideKey<T>): InstanceType<T> | null;
  static get<T extends typeof Model>(this: T, ids: DecideKey<T>[]): InstanceType<T>[];
  static get<T extends typeof Model>(this: T, idOrIds: DecideKey<T>[] | DecideKey<T>): InstanceType<T>[] | InstanceType<T> | null;
  static get<T extends typeof Model>(this: T, idOrIds: DecideKey<T>[] | DecideKey<T>): InstanceType<T>[] | InstanceType<T> | null {
    if (idOrIds == null) return null;

    if (Array.isArray(idOrIds) && (!Array.isArray(this.primaryKey) || Array.isArray(idOrIds[0]))) {
      return idOrIds.map((id) => this.cache.get(this.joinOrReturn(id))).filter((a) => a !== undefined) as InstanceType<T>[];
    }

    const fetchId = (Array.isArray(this.primaryKey) ? idOrIds.toString() : idOrIds) as Key;
    return (this.cache.get(fetchId) as InstanceType<T>) ?? null;
  }

  /**
   * Gets one or multiple models by id or creates them if not existent
   * @param values The model values
   */
  static getOrCreate<T extends typeof Model>(this: T, values: PartialToObject<InstanceType<T>>): InstanceType<T>;
  static getOrCreate<T extends typeof Model>(this: T, values: PartialToObject<InstanceType<T>>[]): InstanceType<T>[];
  static getOrCreate<T extends typeof Model>(this: T, values: PartialToObject<InstanceType<T>>[] | PartialToObject<InstanceType<T>>): InstanceType<T>[] | InstanceType<T>;
  static getOrCreate<T extends typeof Model>(this: T, values: PartialToObject<InstanceType<T>>[] | PartialToObject<InstanceType<T>>): InstanceType<T>[] | InstanceType<T> {
    const isArray = Array.isArray(values);
    const arr = (isArray ? values : [values]) as PartialToObject<InstanceType<T>>[];

    const result = arr.map((values) => {
      const id = this.getPrimaryFromValues(values);
      return this.get(id) ?? this.create(values);
    });

    return isArray ? (result as InstanceType<T>[]) : (result[0] as InstanceType<T>);
  }

  /**
   * Gets one or multiple models by id or creates them if not existent
   * @param idOrIds An id or array of ids
   */
  static fillOrCreate<T extends typeof Model>(this: T, values: PartialToObject<InstanceType<T>>): InstanceType<T>;
  static fillOrCreate<T extends typeof Model>(this: T, values: PartialToObject<InstanceType<T>>[]): InstanceType<T>[];
  static fillOrCreate<T extends typeof Model>(this: T, values: PartialToObject<InstanceType<T>>[] | PartialToObject<InstanceType<T>>): InstanceType<T>[] | InstanceType<T> {
    const isArray = Array.isArray(values);
    const arr = (isArray ? values : [values]) as PartialToObject<InstanceType<T>>[];

    const result = arr.map((values) => {
      const id = this.getPrimaryFromValues(values);
      return this.get(id)?.fill(values) ?? this.create(values);
    });

    return isArray ? (result as InstanceType<T>[]) : (result[0] as InstanceType<T>);
  }

  /**
   * Static way of creating a model
   * @param values Initial values
   */
  static make<T extends typeof Model>(this: T, values = {}): InstanceType<T> {
    return new this(values) as InstanceType<T>;
  }

  /**
   * Create model and save it
   * @param value Initial values
   */
  static create<T extends typeof Model>(this: T, values: PartialToObject<InstanceType<T>>[]): InstanceType<T>[];
  static create<T extends typeof Model>(this: T, value: PartialToObject<InstanceType<T>>): InstanceType<T>;
  static create<T extends typeof Model>(this: T, value: PartialToObject<InstanceType<T>> | PartialToObject<InstanceType<T>>[] = {}) {
    // static create<T extends typeof Model> (this: T, value = {}): InstanceType<T> {
    if (Array.isArray(value)) return this.createAll(value);
    return this.make(value).save() as InstanceType<T>;
  }

  static createAll<T extends typeof Model>(this: T, values: Record<string, unknown>[] = []): InstanceType<T>[] {
    return values.map((value) => this.make(value).save() as InstanceType<T>);
  }

  /**
   * Subscribes a parent model to changes on the child model
   * @param Parent Subscriber to be notified on changes
   * @param nameInParentModel Name of field defined on the parent model
   * @param fieldInParentModel Field object
   */
  static _subscribe(Parent: typeof Model, nameInParentModel: string, fieldInParentModel: Relation) {
    log && console.log(Parent.model, 'wants to subscribe to updates on', this.model);

    const foreignKey = Array.isArray(fieldInParentModel.foreignKey) ? fieldInParentModel.foreignKey : [fieldInParentModel.foreignKey];

    foreignKey.forEach((key) => {
      // Get all parents subscribed to this key
      let parents = this.keyFields.get(key);

      // If there is none, initialize it
      if (parents === undefined) {
        parents = new Map<typeof Model, [string, Relation]>();
        this.keyFields.set(key, parents);
      }

      // Add the parent to subscibers
      if (!parents.has(Parent)) {
        parents.set(Parent, [nameInParentModel, fieldInParentModel]);
      }
    });
  }

  /**
   * Notify all subscribers so they can update their cache
   * @param type Type of change in the Model (ADD / DELETE)
   */
  _notifySubscribers<T extends typeof Model>(this: InstanceType<T>, type: symbol) {
    log && console.log(this.static().model, 'is notifying its dependents with', type);
    this.static().keyFields.forEach((parents, _foreignKey) => {
      parents.forEach(([nameInParentModel, fieldInParentModel], Parent) => {
        // value of the foreignKey
        // const id = this[foreignKey] as Key

        const fKey = fieldInParentModel.foreignKey as PropertyNames<InstanceType<T>> | PropertyNames<InstanceType<T>>[];
        const id = Array.isArray(fKey) ? fKey.map((key) => this[key]) : this[fKey];

        // Get the parent model from registry
        // We have to pass any because typescript mistakenly thinks, that the primary key can only be Key and not CompositeKey
        const model = Parent.getParentRelation<any>(fieldInParentModel, id as DecideKey<T>) as Model;

        // If model doesnt exist, we cant notify it. So we return here
        // It basically means that a model has an id set as foreignKey even though the related model doesnt exist
        // This is either because of bad code or cyclic deletion
        if (!model) return;

        // Update the cache
        model._updateRelationCache(nameInParentModel, fieldInParentModel, type, this);
      });
    });
  }

  /**
   * Updates the relation cache
   * @param name Name of the relation field
   * @param field Relation object
   * @param type Type of change (ADD / DELETE)
   * @param child The model that changed
   */
  _updateRelationCache(name: string, field: AnyRelation, type: symbol, child: Model) {
    log && console.log('update cache for', this.static().model, 'notified by', child.static().model, 'local=', isLocal(field), 'fieldname=', name);

    const isMany = field instanceof HasMany;
    const cache = this._foreignKeyCache;

    // If the cache is undefined, it means the Relation wasnt yet accessed
    // So we would need to load it before we can update it
    // No need to waste time on that if it isnt needed anyway
    if (cache[name] === undefined) {
      return;
    }

    if (type === ADD) {
      if (isMany) {
        // add to the array if it isnt in the array
        if (!cache[name].includes(child.$id)) {
          cache[name].push(child.$id);
        }
      } else {
        cache[name] = child.$id;
      }
    } else if (type === DELETE) {
      if (isMany) {
        // only delete if it exists
        const index = cache[name].indexOf(child.$id);
        if (index > -1) {
          cache[name].splice(index, 1);
        }
      } else {
        // Setting it to null makes it possible to check for undefined above
        // But first we have to check, if this id was actually set as its relation
        // If its not set, this is an orphan model which was still linked
        if (cache[name] === child.$id) {
          cache[name] = null;
        }
      }
    }
  }

  /**
   * Loops through listeners and calls them
   * @param event Name of the event to be emitted
   * @param data Data to be passed to the event handler
   */
  emit(event: string, ...data: any[]) {
    // runs all listener and returns false if any of the listener returns false
    return [...(this._events[event] || [])].reduce((acc, fn) => fn(...data) && acc, true);
  }

  /**
   * Binds a listener to an event
   * @param event Name of the event to be listend to
   * @param cb Listener
   */
  on(event: string, cb: Callback) {
    if (!this._events[event]) {
      this._events[event] = new Set();
    }
    this._events[event].add(cb);
  }

  /**
   * Unbinds a listener to an event
   * @param event Name of the event to be unbound
   * @param cb Listener
   */
  off(event: string, cb: Callback) {
    if (!this._events[event]) return;

    this._events[event].delete(cb);
  }

  /**
   * Delete the model from registry
   */
  delete(cascadeDeletion = true, beforeDelete?: (model: Model) => void) {
    if (this.emit('delete') === false) return this;

    beforeDelete?.(this);
    if (cascadeDeletion) this._triggerCascadeDeletion(beforeDelete);
    this._notifySubscribers(DELETE);
    this.static().cache.delete(this.$id);

    this.emit('deleted');

    return this;
  }

  valueOf() {
    return this;
  }

  toJSON() {
    return this.toObject();
  }

  /**
   * Gives back model as object for further consumption
   */
  toObject<T extends Model, Obj extends ToObject<T>, R extends RelationPropertyNames<T>, P extends PropertyNames<T>>(this: T, relations?: R[]) {
    const obj = Object.assign({}, toRaw(this._cache)) as Obj;

    (this.static().hidden() as P[]).forEach((field) => {
      delete obj[field];
    });

    if (relations) {
      relations.forEach((field) => {
        const val = this[field] as any;
        if (Array.isArray(val)) {
          (obj[field] as any) = val.map((o) => o.toObject());
        } else {
          obj[field] = val.toObject();
        }
      });
    }

    return obj;
  }

  /**
   * Saves the model in the registry
   */
  save<T extends Model>(this: T) {
    if (this.static().cache.has(this.$id)) {
      const model = this.static().cache.get(this.$id) as Model;
      if (model === this) return this as T;
      // https://github.com/microsoft/TypeScript/issues/13086
      return model.fill(this.toObject()) as T;
    }

    this.static().cache.set(this.$id, this);
    this._notifySubscribers(ADD);
    return this as T;
  }

  /**
   * Sets multiple attributes at once
   * @param values The values to be bulk set
   */
  fill(values: Record<string, unknown> = {}) {
    // const fieldEntries = Object.entries(this.static().fields())
    // initCache(fieldEntries, Object.assign({}, this._cache, values), this._cache)
    // this._setRelations(fieldEntries, values)

    // const hiddenToUndefined = (arr: string[]) => {
    //   return arr.reduce((acc, curr) => {
    //     acc[curr] = undefined
    //     return acc
    //   }, {} as Record<string, undefined>)
    // }

    Object.assign(this, values /*, hiddenToUndefined(this.static().hidden()) */);

    return this;
  }

  _triggerCascadeDeletion(beforeDelete?: (model: Model) => void) {
    const cascades = this.static().cascades();

    cascades.forEach((name) => {
      const relation = (this as any)[name] as Model | Model[] | undefined;
      if (Array.isArray(relation)) {
        relation.forEach((r) => r.delete(true, beforeDelete));
      } else {
        // Relation doesnt need to be defined
        relation?.delete(true, beforeDelete);
      }
    });
  }

  clone(relations?: string[]) {
    return this.static().make(this.toObject(relations as any));
  }

  copy<T extends Model>(this: T, relations?: string[]) {
    const copy = this.toObject();
    const pKey = this.static().primaryKey as PropertyNames<T> | PropertyNames<T>[];
    if (Array.isArray(pKey)) {
      pKey.forEach((key) => {
        delete copy[key];
      });
    } else {
      delete copy[pKey];
    }

    if (relations) {
      (relations as RelationPropertyNames<T>[]).forEach((field) => {
        const val = this[field] as any;
        if (Array.isArray(val)) {
          (copy[field] as any) = val.map((o) => o.copy());
        } else {
          copy[field] = val.copy();
        }
      });
    }

    return this.static().make(copy);
  }

  dehydrate<T extends Model>(this: T, relations = this.static().cascades() as RelationPropertyNames<T>[]) {
    const obj = { ...toRaw(this._cache), __class__: this.static().model } as Dehydrate<T>; // & RelationProperties<T>;

    (this.static().hidden() as PropertyNames<T>[]).forEach((field) => {
      delete obj[field];
    });

    if (relations) {
      relations.forEach((field) => {
        const val = this[field] as any; // RelationProperties<T>[typeof field]
        if (!val) return;
        if (Array.isArray(val)) {
          (obj[field] as any) = val.map((o) => o.dehydrate());
        } else {
          obj[field] = val.dehydrate();
        }
      });
    }

    return obj;
  }

  static hydrate<T extends typeof Model>(this: T, values: Dehydrate<InstanceType<T>>): InstanceType<T> {
    if (!values.__class__) {
      throw new Error('Can not hydrate object without class');
    }

    const Type = getModel(values.__class__ as string) as T;

    if (!Type) {
      throw new Error('Model ' + values.__class__ + ' was not found');
    }

    if (Type.hydrate === this.hydrate) {
      return Type.fillOrCreate(values);
    } else {
      return Type.hydrate(values);
    }
  }

  static pivot<T extends typeof Model>(this: T, model1Class: typeof Model | string, model2Class: typeof Model | string) {
    model1Class = getModel(model1Class);
    model2Class = getModel(model2Class);

    const name = [model1Class.model, model2Class.model].sort().join('_');
    return getModel(name);
  }
}

function convertPrimitive<T extends unknown>(value: any, Type: ctor<T> | ((...args: any[]) => T) | typeof Model | undefined): T {
  if (!Type) return value;

  // arrow functions don't have prototypes
  if (Type.prototype && value instanceof Type) return value as T;

  // handle buildin Date gracefully
  if (Type === (Date as any)) return new Date(value) as T;

  if (Type.prototype && ('model' in Type || Type.toString().startsWith('class'))) {
    return new (Type as ctor<T>)(value);
  }

  return (Type as (...args: any[]) => T)(value);
}

export class Field<T extends unknown = unknown, ARRAY extends boolean = false, K extends unknown = {}> {
  // static type = type
  isNullable = false;
  // defaultValue: unknown = null;
  // Type: T;
  declare TType: (ARRAY extends true ? T[] : T) | (K extends null ? (K extends {} ? (K extends undefined ? never : never) : null) : never);

  constructor(public defaultValue: K, public Type: ctor<T> | ((args: any) => T) | typeof Model | undefined) {
    //this.defaultValue = defaultValue;
    // this.Type = isFactory ? Type as (arg: any) => T : makeFactory(Type as ctor<T>)
    // this.Type = Type;
    if (defaultValue === null) {
      this.nullable();
    }
  }

  nullable(trueOrFalse = true) {
    this.isNullable = trueOrFalse;
    return this as unknown as Field<T, ARRAY, null>;
  }

  // getValue (value: unknown) {
  getValue(value: unknown): T | null;
  getValue(values: unknown[]): T[] | null;
  getValue(value: unknown[] | unknown): T | T[] | null {
    // Only get the default, if the value is non nullable and the value is null or undefined,
    // Or if the value is nullable but the value is undefined
    // That means nullable fields need to be set to null explitely because undefined
    // Will trigger the default. For most of nullable fields, null is the default anyway
    // But sometimes fields can nullable and still have a different default
    return this.sanitize((value == null && !this.isNullable) || value === undefined ? this.getDefault() : value);
  }

  getDefault() {
    if (typeof this.defaultValue === 'function') {
      return this.defaultValue();
    }

    return this.defaultValue;
  }

  sanitize(value: unknown): T | null;
  sanitize(values: unknown[]): T[] | null;
  sanitize(value: unknown[] | unknown): T | T[] | null {
    if (value === null) {
      if (!this.isNullable) {
        throw new Error('Field is not nullable');
      }
      return null;
    }

    if (Array.isArray(value)) {
      return value.map((v) => convertPrimitive(v, this.Type));
    }

    return convertPrimitive(value, this.Type);

    // if (isPrimitiveWrapper(this.Type)) return instance.valueOf()
  }
}

const camelCase = (s: string) => {
  return s.charAt(0).toLowerCase() + s.slice(1);
};

abstract class Relation<T extends typeof Model = typeof Model, S extends typeof Model = typeof Model, ARRAY extends boolean = false> extends Field<InstanceType<T>, ARRAY, unknown> {
  sourceModel: S;
  foreignKey: KeyName;
  otherKey: KeyName;
  order: Array<string> | ((a: InstanceType<T>, b: InstanceType<T>) => number) | null;
  declare Type: T;

  constructor(sourceModel: S, related: T | string, foreignKey: KeyName, otherKey: KeyName, defaultValue: unknown = null) {
    if (typeof related === 'string') {
      related = getModel<T>(related);
    }

    super(defaultValue, related);

    this.sourceModel = sourceModel;
    this.foreignKey = foreignKey;
    this.otherKey = otherKey;

    this.order = null;
  }

  // Todo: Allow multiply fields
  orderBy(field: string, direction = 'asc') {
    this.order = [field, direction];
    return this;
  }

  resolveRelation(ids: DecideKey<T> | DecideKey<T>[]): InstanceType<T>[] | InstanceType<T> | null {
    const result = this.Type.get(ids);

    if (!result) return null;

    if (Array.isArray(this.order)) {
      assert(Array.isArray(result), 'Cannot order a single model');
      const [field, direction] = this.order as [PropertyNames<InstanceType<T>>, string];
      result.sort((a, b) => (a[field] < b[field] ? -1 : 1) * (direction === 'asc' ? 1 : -1));
    } else if (typeof this.order === 'function') {
      assert(Array.isArray(result), 'Cannot order a single model');
      result.sort(this.order);
    }
    return result ?? null;
  }

  /**
   * Queries the related model/s of a relation by its/their foreignKey/s
   * @param id One or more foreign keys of the related Model
   * @returns The Model or Models whose key/keys were passed
   */
  getChildren(id: DecideKey<T>) {
    return this.getRelated(id, this.sourceModel.primaryKey);
  }

  /**
   * Queries the parent model/s of a relation by using the foreign keys on the related model
   * @param id One or more foreign keys on the related Model whose parents needs to be found
   * @returns The Model or Models whose key/keys were passed
   */
  // getParentFromParentRelationAndForeignKey(id: Key | Key[]) {
  //   if (Array.isArray(this.otherKey)) {
  //     assert(Array.isArray(id));

  //     // If the composite keys match, we can use them
  //     if (JSON.stringify(this.otherKey) === JSON.stringify(this.sourceModel.primaryKey)) {
  //       return this.sourceModel.get(id);
  //     }

  //     // Otherwise we have to search through all models
  //     const condition = this.otherKey.reduce((acc, curr, index) => {
  //       acc[curr] = (id as Key[])[index];
  //       return acc;
  //     }, {} as Record<NonFunctionPropertyNames<OmitPrivate<InstanceType<S>>>, unknown>);

  //     return this.sourceModel.whereFirst(condition);
  //   } else if (this.otherKey !== this.sourceModel.primaryKey) {
  //     return this.sourceModel.whereFirst({
  //       [this.otherKey]: id,
  //     } as Record<NonFunctionPropertyNames<OmitPrivate<InstanceType<S>>>, unknown>);
  //   } else {
  //     return this.sourceModel.get(id as Key) as Model;
  //   }
  // }

  getParent(id: DecideKey<T>) {
    return this.getRelated(id, this.Type.primaryKey);
  }

  // getManyRelated(ids: Key[] | Key[][], primaryKey: KeyName) {
  //   const foreignKey = this.foreignKey;

  //   // Check for composite key
  //   if (Array.isArray(foreignKey)) {
  //     ids = ids as Key[][];

  //     // If composite keys match, we can just get them directly
  //     // TODO: Unique keys work as well
  //     if (JSON.stringify(foreignKey) === JSON.stringify(primaryKey)) {
  //       return this.Type.get(ids) as Model[];
  //     } else {
  //       // If they dont match, we have to fallback to regular slow search
  //       return ids.map((id) => {
  //         const condition = foreignKey.reduce((acc, curr, index) => {
  //           acc[curr] = id[index];
  //           return acc;
  //         }, {} as Record<string, Key>);

  //         return this.Type.whereFirst(condition) as Model;
  //       });
  //     }
  //   } else {
  //     //
  //   }
  // }

  getRelated(id: DecideKey<T>, primaryKey: KeyName) {
    if (Array.isArray(this.foreignKey)) {
      assert(Array.isArray(id), 'Cannot getRelated with composite keys when only single id given');

      // If the composite keys match, we can use them
      if (JSON.stringify(this.foreignKey) === JSON.stringify(primaryKey)) {
        return this.Type.get(id);
      }

      // Otherwise we have to search through all models by collecting all Keys of the Composite key
      const condition = this.foreignKey.reduce((acc, curr, index) => {
        acc[curr] = id[index]!;
        return acc;
      }, {} as Record<string, Key>);

      return this.Type.whereFirst(condition as any);
    } else if (this.foreignKey !== primaryKey) {
      return this.Type.whereFirst({
        [this.foreignKey]: id,
      } as any);
    } else {
      return this.Type.get(id);
    }
  }

  getPivot(): typeof Model {
    return this.Type;
  }
}

export class HasOne<T extends typeof Model, S extends typeof Model> extends Relation<T, S> {
  // resolveRelation (id: Key[]) {
  //   return this.getChildren(id)
  // }
}

export class BelongsTo<T extends typeof Model, S extends typeof Model> extends Relation<T, S> {
  // resolveRelation (id: Key[]) {
  //   return this.getParent(id)
  // }
}

export class HasMany<T extends typeof Model, S extends typeof Model> extends Relation<T, S, true> {
  constructor(sourceModel: S, related: T | string, foreignKey: KeyName, otherKey: KeyName, _defaultValue = []) {
    super(sourceModel, related, foreignKey, otherKey, []);
  }

  // resolveRelation (id: Key[]) {
  //   return this.getChildren(id)
  // }
}

export class HasManyBy<T extends typeof Model, S extends typeof Model> extends Relation<T, S, true> {
  // FIXME
  declare foreignKey: string;

  constructor(sourceModel: S, related: T | string, foreignKey: KeyName, otherKey: KeyName, _defaultValue = []) {
    super(sourceModel, related, foreignKey, otherKey, []);
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

export class BelongsToMany<T extends typeof Model, S extends typeof Model, P extends typeof Model> extends Relation<T, S, true> {
  pivot: P;
  foreignKey2: KeyName;
  otherKey2: KeyName;
  constructor(sourceModel: S, related: T, pivot: P, foreignKey1: KeyName, foreignKey2: KeyName, otherKey1: KeyName, otherKey2: KeyName, _defaultValue = []) {
    super(sourceModel, related, foreignKey1, otherKey1, []);
    this.pivot = pivot;
    this.foreignKey2 = foreignKey2;
    this.otherKey2 = otherKey2;
  }

  override resolveRelation(ids: DecideKey<T> | DecideKey<T>[]): InstanceType<T>[] | InstanceType<T> | null {
    return this.pivot.get(ids as unknown as DecideKey<P>[]).map((p) => (p as any)[camelCase(this.Type.model)]);
  }

  override getPivot() {
    return this.pivot;
  }
}

type AnyRelation<T extends typeof Model = typeof Model, S extends typeof Model = typeof Model> = HasOne<S, T> | BelongsTo<S, T> | HasMany<S, T> | HasManyBy<S, T> | BelongsToMany<S, T, any>;

export class ComputedField<K, T extends unknown = unknown> extends Field<T, false, unknown> {
  value!: WritableComputedRef<T>;
  getter: (context: K) => T;
  setter: (context: K, value: any) => void;

  constructor(getter: (context: K) => T, setter: (context: K, value: any) => void) {
    super(null, undefined);
    this.getter = getter;
    this.setter = setter;
  }

  createComputed(context: K) {
    this.value = vueComputed<T>({ get: () => this.getter(context), set: (val) => this.setter(context, val) });
    return this;
  }
}

export const defineSchema = <T extends Fields, S extends typeof Model = typeof Model>(fields: (schema: S) => T, base?: S) => {
  const model = class extends (base ?? Model) {
    static override fields() {
      // @ts-expect-error this only errors because I need a default type
      return fields(this);
    }
  };

  return model as unknown as { new (): InferTypeFromFields<T> & InstanceType<S> } & Omit<S, 'new'>;
};

export const modelRegistry = new Map<string, typeof Model>();

export const isLocal = (inst: AnyRelation) => inst instanceof BelongsTo || inst instanceof HasManyBy;
export const isMany = (inst: AnyRelation) => inst instanceof HasMany || inst instanceof HasManyBy || inst instanceof BelongsToMany;

export const setLogging = (enable: boolean) => {
  log = enable;
};

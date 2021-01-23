# vue-model

This library tries to emulate an orm-style data structure in your vue application. It works by defining Models whose attributes are reactive and can directly be used in templates.

## Getting started

Install package

```sh
npm install vue-model
```

Define Model

```typescript
import { Model } from 'vue-model'

class User extends Model {

  // Name of the Model
  static model = 'User'

  // Define fields and relations
  static fields () {
    return {
      id: this.uid(),
      count: this.number(0),
      name: this.string(generateRandomName),
      isAdmin: this.boolean(false),
      session: this.belongsTo(Session),
      sessionId: this.string(null),
      lastLogins: this.array([], Date),
      someObject: this.field({foo: 'bar'}, Object)
    }
  }

}

class Session extends Model {

  // Name of the Model
  static model = 'Session'

  // Define fields and relations
  static fields () {
    return {
      id: this.uid(),
      user: this.hasOne(User),
      loggedIn: this.boolean(false)
    }
  }
}
```

Use Model

```typescript
const user = User.create()
// same as new User().save()

User.get(user.id) === user // true
user.session // null

user.session = {} // creates new session out of {}
user.session // Session
```

## Field-Types

Every type takes a default value or a function generating a default value. Whatever type the default value is, it will be castet to the specified typ. The exception is `uid` which does not take a default value. When `null` is passed, the field is automatically set as nullable.

```typescript
class Dummy extends Model {

  static model = 'Dummy'

  static fields () {
    return {
      // uuid
      id: this.uuid()

      // number
      number: this.number(0).nullable() // default 0 but also nullable

      // string
      string: this.string('Hello World')

      // boolean
      boolean: this.boolean(true)

      // array of numbers
      array: this.array([1,2,3], Number)

      // any other type with default value and constructor function
      field: this.field(Date.now, Date)
    }
  }

}
```

## Relations

vue-model supports all common relations. Relations are resolved on the fly and updated through an internal messaging system.
That means that this implementation does not suffer from filtering big arrays of maybe-children whenever a child model is created and stays blazingly fast (not as other implementations such as VuexORM).

```typescript
class Dummy2 extends Model {

  static model = 'Dummy2'
  static primaryKey = 'id' // this is the default

  static fields () {
    return {
      // hasOne
      child: this.hasOne(ChildModel, foreignKey, localKey)
      
      // only Model parameter is required:
      child: this.hasOne(ChildModel) // foreignKey = 'childModelId', localKey = primaryKey = 'id'

      // string also works

      child: this.hasOne('ChildModel')

      // belongsTo
      parent: this.belongsTo(ParentModel, foreignKey /* = parentModelId */, localKey)
      parentId: this.string(null)

      // hasMany
      children: this.hasMany(ChildModel)

      // hasManyBy
      children: this.hasManyBy(ChildModel)
      childModelId: this.array([], String)

      // belongsToMany
      opinions: this.belongsToMany(Opinion, PivotModel, foreignKey1 /* = dummy2Id */, foreignKey2 /* = opinionId */, localId1, localId2)
    }
  }

}
```

Usually you only need to specify the related model and vue-model will figure out the ids by itself. However, if you want to deviate from the standard you can do so and specify the ids.

## Cascade Deletion

If you want to delete related models if a model is deleted, specify the models to delete in the cascade method:

```typescript
class Dummy3 extends Model {
  static cascade () {
    return [ 'nameOfRelation' ]
  }
}
```

## Creating and retrieving Models

There are several ways to create a new model

```typescript
// Creates an instance but doesnt save it in the registry
// That means it wont appear in other models as relation
const dummy = new Dummy(values)
const dummy = Dummy.make(values)

// To save it, call save which will notify related models
dummy.save()

// Shortcut
const dummy = Dummy.create(values)
// Multiple at once
const dummy = Dummy.create([values, values])
```

And a few more to get a model

```typescript
const dummy = Dummy.get(id)
const dummies = Dummy.get(ids)

const dummies = Dummy.all()

const dummy = Dummy.whereFirst({...conditions})
const dummy = Dummy.whereFirst(checkerFunction)

const dummies = Dummy.where(conditionOrFunction)
```

Sometimes you conditionally want to get or create a model

```typescript
// Looks for the primary key in values and gets the model if it exists, otherwise creates it
const dummy = Dummy.getOrCreate({values})

// Updates an existing model or creates a new one out of values
const dummy = Dummy.fillOrCreate({values})
```

## Other methods

```typescript
const dummy = Dummy.create(values)

// Removes model from registry
dummy.delete()

// Fills model with values and reinitizes missing ones with default values
dummy.fill(values)

// Gives back an unsaved copy of the same model
// Only one instance of the same model can ever exist in the registry.
// Saving this will NOT replace the old model but just update it
dummy.clone()

// Gives back an unsaved copy with new id
dummy.copy()

// Gives back a plain object without relations
dummy.toObject()

// Gives back a plain object with added __class__ field which can be rehydrated
dummy.dehydrate()

// Creates or gets a model of the right type from values (and the property __class__ with the name of the model)
Model.hydrate(values)

// Adds/removes a callback to a model event
dummy.on('event', cb)
dummy.off('event', cb)

// Emits a model event
dummy.emit('event', data)
```
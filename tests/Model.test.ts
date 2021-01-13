import { expect, use } from 'chai'
import * as sinonChai from 'sinon-chai'
import { spy } from 'sinon'
import 'mocha'
import { ADD, DELETE, HasManyBy, HasOne, Model, modelRegistry, Field } from '../src/Model'

use(sinonChai)

describe('Model', () => {
  afterEach(function () {
    modelRegistry.forEach((Type, name) => {
      Type.cache.forEach((model, id) => {
        model.delete()
      })
    })
  })

  describe('static properties', () => {
    const model = new Model()
    class Model2 extends Model {}

    it('has a primary key', () => {
      expect(Model.primaryKey).equal('id')
    })

    it('copies cache and keyFields on extend', () => {
      expect(Model.cache).instanceOf(Map)
      expect(Model.cache).not.equals(Model2.cache)
      expect(Model.keyFields).instanceOf(Map)
      expect(Model.keyFields).not.equals(Model2.keyFields)
    })

  })

  describe('relations', () => {
    class HasOneModel extends Model {
      static fields () {
        return {
          id: this.uid(),
          parentModelId: this.string(null),
          parentModel: this.belongsTo(ParentModel)
        }
      }
    }

    class HasManyModel extends Model {
      static fields () {
        return {
          id: this.uid(),
          parentModelId: this.string(null),
          parentModel: this.belongsTo(ParentModel)
        }
      }
    }

    class HasManyByModel extends Model { }

    class ParentModel extends Model {
      static fields () {
        return {
          id: this.uid(),
          hasOneModel: this.hasOne(HasOneModel),
          hasManyModels: this.hasMany(HasManyModel),
          hasManyByModels: this.hasManyBy(HasManyByModel),
          hasManyByModelIds: this.array<string>([], String)
        }
      }
    }

    it('calls _trigger on Parent when related models are added', () => {
      const triggerSpy = spy(ParentModel.prototype, '_trigger')

      const parentModel = new ParentModel({ id: 5, hasManyByModelIds: [ 1 ] }).save()
      const hasManyByModel = new HasManyByModel({ id: 1 }).save()
      const hasOneModel = new HasOneModel({ parentModelId: 5 }).save()
      const hasManyModel = new HasManyModel({ parentModelId: 5 }).save()

      const fields = ParentModel.fields()

      expect(triggerSpy).to.have.been.calledWithExactly('hasOneModel', fields.hasOneModel, ADD, hasOneModel)
      expect(triggerSpy).to.have.been.calledWithExactly('hasManyModels', fields.hasManyModels, ADD, hasManyModel)

      triggerSpy.restore()
    })

    it('calls _trigger on Parent when related models are removed', () => {
      const triggerSpy = spy(ParentModel.prototype, '_trigger')

      const parentModel = new ParentModel({ id: 5, hasManyByModelIds: [ 1 ] }).save()
      const hasManyByModel = new HasManyByModel({ id: 1 }).save()
      const hasOneModel = new HasOneModel({ parentModelId: 5 }).save().delete()
      const hasManyModel = new HasManyModel({ parentModelId: 5 }).save().delete()

      const fields = ParentModel.fields()

      expect(triggerSpy).to.have.been.calledWithExactly('hasOneModel', fields.hasOneModel, DELETE, hasOneModel)
      expect(triggerSpy).to.have.been.calledWithExactly('hasManyModels', fields.hasManyModels, DELETE, hasManyModel)

      triggerSpy.restore()
    })

    it('sets all relations correctly', () => {
      const parentModel = new ParentModel({ id: 5, hasManyByModelIds: [ 1 ] }).save()
      const hasManyByModel = new HasManyByModel({ id: 1 }).save()
      const hasOneModel = new HasOneModel({ parentModelId: 5 }).save()
      const hasManyModel = new HasManyModel({ parentModelId: 5 }).save()
      console.log(modelRegistry)

      expect(parentModel.hasOneModel).to.equal(hasOneModel)
      expect(parentModel.hasManyModels).to.eql([ hasManyModel ])

    })
  })
})

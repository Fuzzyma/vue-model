import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADD, DELETE, Model, modelRegistry } from '../src/Model';
import { getCompositeModels, getModels } from './createTestModels';

afterEach(function () {
  modelRegistry.forEach((Type) => {
    Type.cache.forEach((model) => {
      model.delete();
    });
  });
});

describe('static properties', () => {
  class Model2 extends Model {}

  it('has a primary key', () => {
    expect(Model.primaryKey).equal('id');
  });

  it('copies cache and keyFields on extend', () => {
    expect(Model.cache).instanceOf(Map);
    expect(Model.cache).not.equals(Model2.cache);
    expect(Model.keyFields).instanceOf(Map);
    expect(Model.keyFields).not.equals(Model2.keyFields);
  });
});

describe('get()', () => {
  class Model2 extends Model {}
  class ModelWithCompositeKey extends Model {
    static override primaryKey = ['id1', 'id2'];
  }

  it('returns one model when passing one id', () => {
    const model = Model2.create({ id: '1' });

    expect(Model2.get('1')).equal(model);
  });

  it('returns null when passing an invalid id', () => {
    expect(Model2.get('1')).equal(null);
  });

  it('returns multiple models when passing multiple ids', () => {
    const model1 = Model2.create({ id: '1' });
    const model2 = Model2.create({ id: '2' });

    expect(Model2.get(['1', '2'])).deep.equal([model1, model2]);
  });

  // Docs: When passing an array that contains invalid ids, only the valid models will be returned
  it('returns only valid models when passing multiple partially invalid ids', () => {
    const model1 = Model2.create({ id: '1' });
    const model2 = Model2.create({ id: '2' });

    expect(Model2.get(['1', '2', '3'])).deep.equal([model1, model2]);
  });

  it('returns one model when passing one composite id', () => {
    const model = ModelWithCompositeKey.create({ id1: '1', id2: '2' });

    expect(ModelWithCompositeKey.get(['1', '2'])).equal(model);
  });

  it('returns null when passing an invalid composite id', () => {
    expect(ModelWithCompositeKey.get(['1', '2'])).equal(null);
  });

  it('returns null when passing a partially invalid composite id', () => {
    ModelWithCompositeKey.create({ id1: '1', id2: '2' });
    expect(ModelWithCompositeKey.get(['1', '3'])).equal(null);
  });

  it('returns multiple models when passing multiple composite ids', () => {
    const model1 = ModelWithCompositeKey.create({ id1: '1', id2: '2' });
    const model2 = ModelWithCompositeKey.create({ id1: '3', id2: '4' });

    expect(
      ModelWithCompositeKey.get([
        ['1', '2'],
        ['3', '4'],
      ]),
    ).deep.equal([model1, model2]);
  });

  it('returns only valid models when passing multiple partially invalid composite ids', () => {
    ModelWithCompositeKey.create({ id1: '1', id2: '2' });
    ModelWithCompositeKey.create({ id1: '3', id2: '4' });
    expect(
      ModelWithCompositeKey.get([
        ['1', '2'],
        ['3', '5'],
      ]),
    ).deep.equal([ModelWithCompositeKey.get(['1', '2'])]);
  });
});

describe('getOrCreate()', () => {
  class Model2 extends Model {
    declare id: string;
  }
  class ModelWithCompositeKey extends Model {
    declare id1: string;
    declare id2: string;
    static override primaryKey = ['id1', 'id2'];
  }

  it('returns one model when passing one id', () => {
    const model = Model2.create({ id: '1' });

    expect(Model2.getOrCreate({ id: '1' })).equal(model);
  });

  it('creates one model when passing nonexisting id', () => {
    const model = Model2.getOrCreate({ id: '1' });
    expect(model).equal(Model2.get('1'));
  });

  it('creates one model when passing no id', () => {
    const model = Model2.getOrCreate({});
    expect(model).instanceOf(Model2);
    expect(model.$id).toBeTruthy();
  });

  it('creates multiple models when passing multiple ids', () => {
    const models = Model2.create([{ id: '1' }, { id: '2' }]);
    expect(Model2.get(['1', '2'])).deep.equal(models);
  });

  it('creates and gets multiple models when passing multiple ids', () => {
    const model = Model2.create({ id: '1' });
    const models = Model2.create([{ id: '1' }, { id: '2' }]);

    expect(Model2.get(['1', '2'])).deep.equal(models);
    expect(model).equal(models[0]);
  });

  it('returns one model when passing one composite id', () => {
    const model = ModelWithCompositeKey.create({ id1: '1', id2: '2' });

    expect(ModelWithCompositeKey.getOrCreate({ id1: '1', id2: '2' })).equal(model);
  });

  it('creates one model when passing nonexisting composite id', () => {
    const model = ModelWithCompositeKey.getOrCreate({ id1: '1', id2: '2' });
    expect(model).equal(ModelWithCompositeKey.get(['1', '2']));
  });

  it('creates one model when passing no composite id', () => {
    const model = ModelWithCompositeKey.getOrCreate({});
    expect(model).instanceOf(ModelWithCompositeKey);
    expect(model.$id).toBeTruthy();
  });

  it('creates multiple models when passing multiple composite ids', () => {
    const models = ModelWithCompositeKey.create([
      { id1: '1', id2: '2' },
      { id1: '3', id2: '4' },
    ]);

    expect(
      ModelWithCompositeKey.get([
        ['1', '2'],
        ['3', '4'],
      ]),
    ).deep.equal(models);
  });

  it('creates and gets multiple models when passing multiple composite ids', () => {
    const model = ModelWithCompositeKey.create({ id1: '1', id2: '2' });
    const models = ModelWithCompositeKey.create([
      { id1: '1', id2: '2' },
      { id1: '3', id2: '4' },
    ]);

    expect(
      ModelWithCompositeKey.get([
        ['1', '2'],
        ['3', '4'],
      ]),
    ).deep.equal(models);
    expect(model).equal(models[0]);
  });
});

describe('fillOrCreate()', () => {
  class Model2 extends Model {
    declare name: string;
    declare id: string;

    static override fields() {
      return {
        id: this.uid(),
        name: this.string(null),
      };
    }
  }
  class ModelWithCompositeKey extends Model {
    declare name: string;
    declare id1: string;
    declare id2: string;
    static override primaryKey = ['id1', 'id2'];

    static override fields() {
      return {
        id1: this.uid(),
        id2: this.uid(),
        name: this.string(null),
      };
    }
  }

  it('updates existing model when passing id', () => {
    const model = Model2.create({ id: '1', name: 'Franz' });

    const updated = Model2.fillOrCreate({ id: '1', name: 'Klaus' });

    expect(updated).equal(model);
    expect(updated.name).equal('Klaus');
  });

  it('creates new model with non existing id', () => {
    const model = Model2.fillOrCreate({ id: '1', name: 'Franz' });

    expect(model).equal(Model2.get('1'));
  });

  it('updates existing model when passing composite id', () => {
    const model = ModelWithCompositeKey.create({ id1: '1', id2: '2', name: 'Franz' });

    const updated = ModelWithCompositeKey.fillOrCreate({ id1: '1', id2: '2', name: 'Klaus' });

    expect(updated).equal(model);
    expect(updated.name).equal('Klaus');
  });

  it('creates new model with non existing composite id', () => {
    const model = ModelWithCompositeKey.fillOrCreate({ id1: '1', id2: '2', name: 'Franz' });

    expect(model).equal(ModelWithCompositeKey.get(['1', '2']));
  });
});

// TODO: check of relations work with composite keys and mixtures

describe('relations', () => {
  const { HasManyByModel, HasManyModel, HasOneModel, ParentModel, BelongsToManyModel } = getModels();

  describe('hasOne()/belongsTo()', () => {
    it('correctly resolves hasOne relation to both sides', () => {
      const hasOneModel = HasOneModel.create({ id: '1', parentModelId: '1' });
      const parentModel = ParentModel.create({ id: '1' });

      expect(parentModel.hasOneModel).equal(hasOneModel);
      expect(hasOneModel.parentModel).equal(parentModel);
    });

    it('correcly resolves hasOne to null on both sides if relation cant be found', () => {
      const hasOneModel = HasOneModel.create({ id: '1', parentModelId: '2' });
      const parentModel = ParentModel.create({ id: '1' });

      expect(parentModel.hasOneModel).equal(null);
      expect(hasOneModel.parentModel).equal(null);
    });
  });

  describe('hasMany()/belongsTo()', () => {
    it('correctly resolves hasMany relation to both sides', () => {
      const hasManyModel = HasManyModel.create({ id: '1', parentModelId: '1' });
      const parentModel = ParentModel.create({ id: '1' });

      expect(parentModel.hasManyModels).deep.equal([hasManyModel]);
      expect(hasManyModel.parentModel).equal(parentModel);
    });

    it('correctly resolves hasMany to empty array / null', () => {
      const hasManyModel = HasManyModel.create({ id: '1', parentModelId: '2' });
      const parentModel = ParentModel.create({ id: '1' });

      expect(parentModel.hasManyModels).deep.equal([]);
      expect(hasManyModel.parentModel).equal(null);
    });
  });

  describe('belongsToMany()', () => {
    it.skip('works', () => {
      const belongsToManyModel1 = BelongsToManyModel.create({ id: '1' });
      const belongsToManyModel2 = BelongsToManyModel.create({ id: '2' });

      const PivotModel = Model.pivot(BelongsToManyModel, BelongsToManyModel);

      PivotModel.create({
        model1Id: belongsToManyModel1.$id,
        model2Id: belongsToManyModel2.$id,
      });

      expect(belongsToManyModel1.belongsToManyModels).deep.equal([belongsToManyModel2]);
      expect(belongsToManyModel2.belongsToManyModels).deep.equal([belongsToManyModel1]);
    });
  });

  describe('hasManyBy()', () => {
    it('correctly resolves hasManyBy relation', () => {
      const hasManyByModel = HasManyByModel.create({ id: '1' });
      const parentModel = ParentModel.create({ id: '1', hasManyByModelIds: ['1'] });

      expect(parentModel.hasManyByModels).deep.equal([hasManyByModel]);
      // TODO: inverse relation of hasManyBy?
      // expect(hasManyByModel.parentModel).equal(parentModel);
    });

    it('correctly resolves hasManyBy to empty array', () => {
      const parentModel = ParentModel.create({ id: '1' });
      expect(parentModel.hasManyByModels).deep.equal([]);
    });
  });

  it('calls _updateRelationCache on Parent when related models are added', () => {
    const triggerSpy = vi.spyOn(ParentModel.prototype, '_updateRelationCache');

    const _parentModel = ParentModel.create({
      id: '5',
      hasManyByModelIds: ['1'],
    });
    const _hasManyByModel = HasManyByModel.create({ id: '1' });
    const hasOneModel = HasOneModel.create({ parentModelId: '5' });
    const hasManyModel = HasManyModel.create({ parentModelId: '5' });

    const fields = ParentModel.fields();

    expect(triggerSpy).toHaveBeenCalledWith('hasOneModel', fields.hasOneModel, ADD, hasOneModel);
    expect(triggerSpy).toHaveBeenCalledWith('hasManyModels', fields.hasManyModels, ADD, hasManyModel);

    triggerSpy.mockRestore();
  });

  it('calls _updateRelationCache on Parent when related models are removed', () => {
    const triggerSpy = vi.spyOn(ParentModel.prototype, '_updateRelationCache');

    const _parentModel = ParentModel.create({
      id: '5',
      hasManyByModelIds: ['1'],
    });
    const _hasManyByModel = HasManyByModel.create({ id: '1' });
    const hasOneModel = HasOneModel.create({ parentModelId: '5' }).delete();
    const hasManyModel = HasManyModel.create({ parentModelId: '5' }).delete();

    const fields = ParentModel.fields();

    expect(triggerSpy).toHaveBeenCalledWith('hasOneModel', fields.hasOneModel, DELETE, hasOneModel);

    expect(triggerSpy).toHaveBeenCalledWith('hasManyModels', fields.hasManyModels, DELETE, hasManyModel);

    triggerSpy.mockRestore();
  });

  it('sets all relations correctly', () => {
    const parentModel = ParentModel.create({
      id: '5',
      hasManyByModelIds: ['1'],
    });
    const _hasManyByModel = HasManyByModel.create({ id: '1' });
    const hasOneModel = HasOneModel.create({ parentModelId: '5' });
    const hasManyModel = HasManyModel.create({ parentModelId: '5' });

    expect(parentModel.hasOneModel).to.equal(hasOneModel);
    expect(parentModel.hasManyModels).to.eql([hasManyModel]);
  });
});

describe('relations (using composite keys)', () => {
  const { HasManyByModelComposite, HasManyModelComposite, HasOneModelComposite, ParentModelComposite } = getCompositeModels();

  describe('hasOne()/belongsTo()', () => {
    it('correctly resolves hasOne relation to both sides', () => {
      const hasOneModel = HasOneModelComposite.create({ id1: '1', id2: '2', parentModelCompositeId: ['1', '2'] });
      const parentModel = ParentModelComposite.create({ id1: '1', id2: '2' });

      expect(parentModel.hasOneModelComposite).equal(hasOneModel);
      expect(hasOneModel.parentModelComposite).equal(parentModel);
    });

    it('correcly resolves hasOne to null on both sides if relation cant be found', () => {
      const hasOneModel = HasOneModelComposite.create({ id1: '1', id2: '2', parentModelCompositeId: ['1', '3'] });
      const parentModel = ParentModelComposite.create({ id1: '1', id2: '2' });

      expect(parentModel.hasOneModelComposite).equal(null);
      expect(hasOneModel.parentModelComposite).equal(null);
    });
  });

  describe('hasMany()/belongsTo()', () => {
    it('correctly resolves hasMany relation to both sides', () => {
      const hasManyModel = HasManyModelComposite.create({ id1: '5', id2: '6', parentModelCompositeId: ['1', '2'] });
      const parentModel = ParentModelComposite.create({ id1: '1', id2: '2' });

      expect(parentModel.hasManyModelsComposite).deep.equal([hasManyModel]);
      expect(hasManyModel.parentModelComposite).equal(parentModel);
    });

    it('correctly resolves hasMany to empty array / null', () => {
      const hasManyModel = HasManyModelComposite.create({ id1: '5', id2: '6', parentModelCompositeId: ['1', '3'] });
      const parentModel = ParentModelComposite.create({ id1: '1', id2: '2' });

      expect(parentModel.hasManyModelsComposite).deep.equal([]);
      expect(hasManyModel.parentModelComposite).equal(null);
    });
  });

  describe('belongsToMany()', () => {
    it.skip('works', () => {
      // const belongsToManyModel1 = BelongsToManyModelComposite.create({ id: 1 });
      // const belongsToManyModel2 = BelongsToManyModelComposite.create({ id: 2 });
      // const PivotModel = Model.pivot(BelongsToManyModelComposite, BelongsToManyModelComposite);
      // PivotModel.create({
      //   model1Id: belongsToManyModel1.$id,
      //   model2Id: belongsToManyModel2.$id,
      // });
      // expect(belongsToManyModel1.belongsToManyModels).deep.equal([belongsToManyModel2]);
      // expect(belongsToManyModel2.belongsToManyModels).deep.equal([belongsToManyModel1]);
    });
  });

  describe('hasManyBy()', () => {
    it('correctly resolves hasManyBy relation', () => {
      const hasManyByModel = HasManyByModelComposite.create({ id1: '1', id2: '2' });
      const parentModel = ParentModelComposite.create({ id1: '1', id2: '2', hasManyByModelCompositeIds: [['1', '2']] });

      expect(parentModel.hasManyByModelsComposite).deep.equal([hasManyByModel]);
      // TODO: inverse relation of hasManyBy?
      // expect(hasManyByModel.parentModel).equal(parentModel);
    });

    it('correctly resolves hasManyBy to empty array', () => {
      const parentModel = ParentModelComposite.create({ id1: '1', id2: '2', hasManyByModelCompositeIds: [['2', '5']] });
      expect(parentModel.hasManyByModelsComposite).deep.equal([]);
    });
  });
});

describe('relation using non-primary keys', () => {
  it('allows to specify different key than the primary key', () => {
    const { HasOneModel, ParentModel } = getModels();

    const hasOneModel = HasOneModel.create({ alternativeParentModelId: '1' });
    const parentModel = ParentModel.create({ otherKey: '1' });

    expect(parentModel.hasOneAlternativeModel).equal(hasOneModel);
    expect(hasOneModel.alternativeParentModel).equal(parentModel);
  });
});

describe('initialize with relation data', () => {
  it('hasOne()', () => {
    const { HasOneModel, ParentModel } = getModels();

    const model = ParentModel.create({
      hasOneModel: {},
      hasOneAlternativeModel: {},
    });

    expect(model.hasOneModel).instanceOf(HasOneModel);
    expect(model.hasOneAlternativeModel).instanceOf(HasOneModel);
    expect(model.hasOneModel?.parentModel).equal(model);
    expect(model.hasOneAlternativeModel?.alternativeParentModel).equal(model);
  });

  it('belongsTo()', () => {
    const { HasOneModel, ParentModel } = getModels();

    const model = HasOneModel.create({
      parentModel: {},
      alternativeParentModel: {},
    });

    expect(model.parentModel).instanceOf(ParentModel);
    expect(model.parentModel?.hasOneModel).equal(model);
  });
});

describe.skip('default values');
describe.skip('automatic casting / factories');
describe.skip('computed fields');
describe.skip('vue-integration', () => {
  it('doesnt trigger watchEffect when setting a value');
});
describe.skip('querying');
describe.skip('delete()');
describe.skip('toObject()');
describe.skip('hydration');
describe.skip('clone()');
describe.skip('copy()');
describe.skip('relation ordering');

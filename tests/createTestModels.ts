import { Model, type CompositeKey } from '../src/Model';

export const getModels = () => {
  class HasOneModel extends Model {
    declare parentModel: ParentModel | null;
    declare alternativeParentModel: ParentModel | null;
    declare alternativeParentModelId: string | null;
    declare id: string;
    declare parentModelId: string | null;

    static override fields() {
      return {
        id: this.uid(),
        alternativeParentModelId: this.uid(),
        alternativeParentModel: this.hasOne(ParentModel, 'alternativeParentId', 'otherKey'),
        parentModelId: this.string(null),
        parentModel: this.belongsTo(ParentModel),
      };
    }
  }

  class HasManyModel extends Model {
    declare id: string;
    declare parentModel: ParentModel | null;
    declare parentModelId: string | null;

    static override fields() {
      return {
        id: this.uid(),
        parentModelId: this.string(null),
        parentModel: this.belongsTo(ParentModel),
      };
    }
  }

  class HasManyByModel extends Model {}

  class ParentModel extends Model {
    declare hasManyModels: HasManyModel[];
    declare hasManyByModels: HasManyByModel[];
    declare hasOneModel: HasOneModel | null;
    declare hasOneAlternativeModel: HasOneModel | null;
    declare hasManyByModelIds: string[];
    declare otherKey: string;
    declare id: string;

    static override fields() {
      return {
        id: this.uid(),
        otherKey: this.uid(),
        hasOneModel: this.hasOne(HasOneModel),
        hasOneAlternativeModel: this.hasOne(HasOneModel, 'alternativeParentModelId', 'otherKey'),
        hasManyModels: this.hasMany(HasManyModel),
        hasManyByModels: this.hasManyBy(HasManyByModel),
        hasManyByModelIds: this.array<string>([]),
      };
    }
  }

  class BelongsToManyModel extends Model {
    declare belongsToManyModels: BelongsToManyModel[];
    declare id: string;

    static override fields() {
      return {
        id: this.uid(),
        belongsToManyModels: this.belongsToMany(BelongsToManyModel),
      };
    }
  }

  return {
    HasOneModel,
    HasManyModel,
    HasManyByModel,
    ParentModel,
    BelongsToManyModel,
  };
};

export const getCompositeModels = () => {
  class HasOneModelComposite extends Model {
    declare parentModelComposite: ParentModelComposite | null;
    declare parentModelCompositeId: CompositeKey | null;
    static override primaryKey = ['id1', 'id2'];
    declare id1: string;
    declare id2: string;

    static override fields() {
      return {
        id1: this.uid(),
        id2: this.uid(),
        parentModelCompositeId: this.array<string>(),
        parentModelComposite: this.belongsTo(ParentModelComposite),
      };
    }
  }

  class HasManyModelComposite extends Model {
    declare parentModelComposite: ParentModelComposite | null;
    declare parentModelCompositeId: CompositeKey | null;
    static override primaryKey = ['id1', 'id2'];
    declare id1: string;
    declare id2: string;

    static override fields() {
      return {
        id1: this.uid(),
        id2: this.uid(),
        parentModelCompositeId: this.array<string>([]),
        parentModelComposite: this.belongsTo(ParentModelComposite),
      };
    }
  }

  class HasManyByModelComposite extends Model {
    static override primaryKey = ['id1', 'id2'];
  }

  class ParentModelComposite extends Model {
    static override primaryKey = ['id1', 'id2'];

    declare hasManyModelsComposite: HasManyModelComposite[];
    declare hasManyByModelsComposite: HasManyByModelComposite[];
    declare hasOneModelComposite: HasOneModelComposite | null;
    declare hasManyByModelCompositeIds: string[][];
    declare id1: string;
    declare id2: string;

    static override fields() {
      return {
        id1: this.uid(),
        id2: this.uid(),
        hasOneModelComposite: this.hasOne(HasOneModelComposite),
        hasManyModelsComposite: this.hasMany(HasManyModelComposite),
        hasManyByModelsComposite: this.hasManyBy(HasManyByModelComposite),
        hasManyByModelCompositeIds: this.array(),
      };
    }
  }

  return {
    HasOneModelComposite,
    HasManyModelComposite,
    HasManyByModelComposite,
    ParentModelComposite,
  };
};

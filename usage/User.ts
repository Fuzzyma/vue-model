import { boolean, computed, defineSchema, Model, string } from '../src/Model';

// const defaultValue = (val: any) => {
//   return (target: any, propertyKey: string) => {
//     Reflect.
//   };
// };

// const field = target.static()._fields[propertyKey]().nullable();

// https://github.com/Microsoft/TypeScript/issues/4881
// const fields = <T extends typeof Model, F extends Fields>(fn: (fields: T) => F) => {
//   return (target: T) => {
//     // return class extends model<F, T>(fn, target) {};
//     return class extends target {
//       static override fields() {
//         return fn(this);
//       }
//     } as unknown as { new (): InferTypeFromFields<F> & InstanceType<T> } & Omit<T, 'new'>;

//     // target.fields = function () {
//     //   return fn(target);
//     // };

//     // return target as { new (): InferTypeFromFields<F> & InstanceType<T> } & Omit<T, 'new'>;
//     // console.log(target, fn(target));
//   };
// };

export class Address extends Model {
  declare ['constructor']: typeof Address;
  static override model = 'Address';

  @string()
  declare city: string;

  @string()
  declare street: string;

  @boolean()
  declare exists: boolean;
}

const a = new Address();
a.city;

class B {
  name: string;
  asd!: number;
  constructor(name: string | B) {
    if (typeof name === 'string') {
      this.name = name;
    } else {
      this.name = name.name;
    }
  }
}

export class Foo extends defineSchema((schema) => {
  return {
    id: schema.uid(),
    name: schema.string(),
    asd: schema.number(),
    something: schema.array(['ads', 'asd']),
    foo: schema.field(undefined, (_val: number) => 2).nullable(),
    fooArr: schema.field(null, (_val: number[]) => [2]),
    // obj: schema.field(null, Number),
    bar: schema.hasOne(Address),
    baz: schema.hasMany(Address),
    qux: schema.belongsTo(Address),
    quux: schema.belongsToMany(Address),
    quuz: schema.hasManyBy(Address),
    objWithCtor: schema.field('asd', B),
    objWithFactory: schema.field(undefined, Date),
  };
}) {
  @computed((ctx) => ctx.asd + ctx.asd)
  declare computed: number;
}

Foo.create({});
const b = new Foo();
b.fooArr;

console.log(b);

// export const User = defineModel(() => {
//   const id = schema.uuid()
//   const firstName = schema.string()
//   const lastName = schema.string()

//   const fullName = computed(() => firstName.value + ' ' + lastName.value)

//   return {
//       id,
//       firstName,
//       lastName,
//       fullName,
//   }
// })

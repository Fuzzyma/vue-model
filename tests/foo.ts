const Model = defineSchema((schema) => {
  return {
    id: schema.uid(),
    string: schema.string(),
    number: schema.number(null),
  };
});

class Model extends defineSchema((schema) => {
  return {
    id: schema.uid(),
    string: schema.string(),
    number: schema.number(null),
  };
}) {
  @computed((ctx) => ctx.string + ctx.string)
  declare foo: string;

  someMethod() {
    //
  }
}

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint'
  ],
  extends: [ 'standard', 'plugin:@typescript-eslint/recommended' ],
  rules: {
    'operator-linebreak': [ 'error', 'before' ],
    'object-curly-spacing': [ 'error', 'always' ],
    'array-bracket-spacing': [ 'error', 'always' ],
    indent: [ 'error', 2, { flatTernaryExpressions: true, SwitchCase: 1 } ],
    'padded-blocks': 'off'
  }

}

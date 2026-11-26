/**
 * Strips console.log and console.debug calls in production builds while preserving
 * console.error and console.warn for critical runtime diagnostics.
 */
function stripProductionConsolePlugin({ types: t }) {
  return {
    name: 'strip-production-console',
    visitor: {
      CallExpression(path) {
        const callee = path.get('callee');
        if (
          callee.isMemberExpression() &&
          callee.get('object').isIdentifier({ name: 'console' }) &&
          !callee.node.computed
        ) {
          const prop = callee.get('property');
          if (prop.isIdentifier({ name: 'log' }) || prop.isIdentifier({ name: 'debug' })) {
            if (path.parentPath.isExpressionStatement()) {
              path.parentPath.remove();
            } else {
              path.replaceWith(t.unaryExpression('void', t.numericLiteral(0)));
            }
          }
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV);
  const isProd = process.env.NODE_ENV === 'production';
  const plugins = isProd ? [stripProductionConsolePlugin] : [];
  plugins.push('react-native-reanimated/plugin');
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins,
  };
};

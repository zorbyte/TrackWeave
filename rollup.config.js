import typescript from 'rollup-plugin-typescript2';
import pkg from './package.json';
import resolve from '@rollup/plugin-node-resolve';

export default {
    input: 'src/index.ts',
    output: [
      {
        file: pkg.browser,
        format: 'iife',
        name: 'trackweave'
      },
      {
        file: pkg.module,
        format: 'es',
        name: 'trackweave'
      }
    ],
    plugins: [
        typescript({
          typescript: require('typescript'),
          tsconfig: "tsconfig.rollup.json"
        }),
        resolve({
            browser: true
        }),
      ],
    }
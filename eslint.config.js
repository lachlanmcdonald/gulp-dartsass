import globals from 'globals';
import pluginJs from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { rules } from '@lmcd/eslint-config';
import jest from 'eslint-plugin-jest';

export default [
	pluginJs.configs.recommended,
	{
		rules,
		files: ['**/*.js'],
		plugins: {
			'@stylistic': stylistic,
		},
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node,
				...globals.browser,
					'jest/globals': true,
			},
		},
	}, {
		files: ['**/*.test.js'],
		...jest.configs['flat/recommended'],
		rules: {
			...jest.configs['flat/recommended'].rules,
		},
	},
];

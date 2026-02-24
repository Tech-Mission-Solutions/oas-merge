/** * TYPES
 */
export type HttpMethod = string | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

export interface PathConfig {
  glob: string;
  methods?: HttpMethod[];
}

export interface Selection {
  paths?: PathConfig[];
  tags?: string[];
}

export interface InputSource {
  url: string;
  prefix?: string;
  include?: Selection;
  exclude?: Selection;
}

export interface MergeConfig {
  output?: string;
  inputs: InputSource[];
}
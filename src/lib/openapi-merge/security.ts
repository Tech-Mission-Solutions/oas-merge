import { MergeInput } from './data';
import { Swagger } from 'atlassian-openapi';

export function mergeSecurity(inputs: MergeInput): Swagger.SecurityRequirement[] | undefined {
  const result = new Array<Swagger.SecurityRequirement>();

  const seenSecurity = new Set<string>();
  inputs.forEach(input => {
    const { security } = input.oas;
    if (security !== undefined) {
      security.forEach(_security => {
        Object.keys(_security).forEach(s => {
          if(!seenSecurity.has(s)) {
            seenSecurity.add(s);
            result.push({
              [s]: _security[s]
            })
          }
        })
      });
    }
  });

  if (result.length === 0) {
    return undefined;
  }

  return result;
}
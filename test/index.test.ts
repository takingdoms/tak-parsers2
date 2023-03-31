import { isTdfParserError, TdfJsonUtils, TdfStringParser } from '../src/index';

const MINI_TDF = `
// hello world

[CUSTOMKEYS] {
  EMPTY=;;
  FOO = foo; // '�'
  BAR = b a r; // '�'
  XCHAR_FF = before; // '�'
  //XCHAR_FF = after; // '�'

  [sub1]

  {
    BAZ = baz ;
  }

  [SUB2]

  {
  }
}
`;

test('parsing and converting to json', () => {
  const data = MINI_TDF;
  const tree = TdfStringParser.parseTree(data);

  console.log(tree);

  const isError = isTdfParserError(tree);

  expect(isError).toBeFalsy();

  if (isError) {
    return;
  }

  console.log(JSON.stringify(tree, null, 4));

  const json = TdfJsonUtils.toJson(tree);

  console.log(json);
});

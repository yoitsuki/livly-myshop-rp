# 仕様書 — レプリカ管理 (原本 / レプリカの記録 + 検索)

## 用語

**ゲーム内呼称は「原本」** (= オリジナル) と「レプリカ」。
「本物」は誤訳。**コード / UI / コミット / コメントすべて「原本」表記で統一**。

英語表現は `replica` / `original`。`isReplica: boolean` を中核フィールドにし、
`!isReplica` を「原本」とみなす ( 既存ドキュメントの後方互換も兼ねる )。

## 背景

リヴリー内では同じ見た目で「原本」と「レプリカ」が分かれて流通するアイテムがある。
価格帯が明確に違うため、admin で記録 + ホームから検索で絞れるようにしたい。

## データモデル

### `Item` への追加 ( `src/lib/firebase/types.ts` )

```ts
export interface Item {
  // 既存フィールド省略
  /** true = レプリカ。undefined / false = 原本 ( 既定 ) 。 */
  isReplica?: boolean;
}
```

### マッパー ( `src/lib/firebase/mappers.ts` )

`itemToFs`:

```ts
export function itemToFs(item: Item): DocumentData {
  return compact({
    // 既存フィールド省略
    isReplica: item.isReplica,
  });
}
```

`compact()` が `undefined` を落とすので、原本アイテムは Firestore に
`isReplica` フィールドを書かない (= スキーマ汚さない )。

`itemFromFs`:

```ts
export function itemFromFs(id: string, data: DocumentData): Item {
  return {
    // 既存フィールド省略
    isReplica: data.isReplica === true ? true : undefined,
  };
}
```

`true` のみ拾い、それ以外は `undefined`。truthy 判定で広く拾うと意図しない
データを誤判定するので明示的に。

### マイグレーション

**不要**。既存ドキュメントは全部 `isReplica: undefined` 扱い ( = 原本 )。

---

## UI

### 1. 登録フォーム ( `/register` ) + 編集フォーム ( `/items/[id]/edit` )

タグピッカーの直前 ( or 直後 ) にチェックボックス 1 つ。

```tsx
<label className="flex items-center gap-2 px-1 py-2 cursor-pointer">
  <input
    type="checkbox"
    checked={form.isReplica}
    onChange={(e) => setForm({ ...form, isReplica: e.target.checked })}
    className="w-4 h-4 accent-[var(--color-gold-deep)]"
  />
  <span className="text-[13px]" style={{ fontFamily: "var(--font-body)" }}>
    レプリカ
  </span>
  <span className="text-[10.5px] text-[var(--color-muted)] ml-1">
    ( 原本でない場合のみ ON )
  </span>
</label>
```

`FormState` に `isReplica: boolean` を追加 ( 既定 false )。`onSave` で
`isReplica: form.isReplica || undefined` で渡す ( false は undefined で記録 )。

### 2. ホームのフィルタ ( `/` )

タグフィルタ列の上か、`Sort` プルダウンと同じ行に **3 値セグメント** を置く:

```
[ 原本のみ ][ 両方 ][ レプリカのみ ]
```

実装:

```tsx
type ReplicaFilter = "original" | "all" | "replica";
const [replicaFilter, setReplicaFilter] = useState<ReplicaFilter>("all");

// items を絞る
const filtered = useMemo(() => {
  let list = items ?? [];
  if (replicaFilter === "original") {
    list = list.filter((i) => !i.isReplica);
  } else if (replicaFilter === "replica") {
    list = list.filter((i) => i.isReplica === true);
  }
  // 既存の q / activeCategory / activeTagIds 絞り込みに続く
  // ...
}, [items, q, activeCategory, activeTagIds, sort, replicaFilter]);
```

UI は既存の `CategoryChip` と同じ Atelier の「角丸ゼロ + 1px 枠 + active で gold」
スタイルでセグメント風に並べる。各ボタンに件数を出すと便利:

- 原本のみ ( N )
- 両方 ( M )
- レプリカのみ ( K )

件数の memo は `items` から計算。

### 3. 詳細カード ( `/items/[id]` ) のバッジ

タイトルブロックの隣 or アイコン下に小さく「REPLICA」バッジ。
`isReplica === true` の時のみ表示 ( 原本にはバッジなし )。

```tsx
{item.isReplica && (
  <span
    className="shrink-0 inline-flex items-center leading-none whitespace-nowrap"
    style={{
      fontFamily: "var(--font-label)",
      fontSize: 9.5,
      fontWeight: 500,
      letterSpacing: "0.18em",
      padding: "3px 7px",
      borderRadius: 0,
      background: "transparent",
      color: "var(--color-gold-deep)",
      border: "1px solid var(--color-gold-deep)",
    }}
  >
    REPLICA
  </span>
)}
```

### 4. 一覧 ( `ItemCard` ) のバッジ

詳細カードと同じデザインで小さめ ( fontSize 8.5 程度 ) 。
原本アイテムには出さない ( = 既定状態のミニマル維持 )。

### 5. bulk / inbox の行 UI には入れない ( v1 )

`BulkRow` 行内にチェックボックスを増やすと密度が辛い。bulk / inbox から
登録した直後はすべて「原本」扱いで作成し、必要なら詳細編集で切り替える運用で十分。
`BulkEntry` には `isReplica` を持たない。

---

## 実装手順

1. `src/lib/firebase/types.ts` の `Item` に `isReplica?: boolean` 追加
2. `src/lib/firebase/mappers.ts` の `itemToFs` / `itemFromFs` 更新
3. `src/app/register/page.tsx`:
   - `FormState` に `isReplica: boolean`
   - `EMPTY_FORM` に `isReplica: false`
   - フォームに checkbox 追加
   - `createItem` 呼出時 `isReplica: form.isReplica || undefined`
   - bulk-edit init からも復元 ( `bulkEntry` には持たないので false 既定で OK )
4. `src/app/items/[id]/edit/page.tsx`:
   - 同様にフォーム追加
   - `updateItem` 経由で書き戻す
5. `src/app/page.tsx`:
   - `replicaFilter` state
   - 件数 memo
   - セグメント UI (3 ボタン)
   - filtered の絞り込みに条件追加
6. `src/app/items/[id]/page.tsx` ( 詳細 ):
   - REPLICA バッジ追加
7. `src/components/ItemCard.tsx`:
   - 一覧用の小さい REPLICA バッジ
8. `src/lib/version.ts` に bump コメント
9. build 確認 → commit → push

## バージョン

`0.18.0` 候補 (機能追加のため minor を上げる)。

## viewer 同期

viewer も同じ Firestore を読むので、以下の同期が必要:

- `Item` 型の `isReplica?: boolean` 追加
- `mappers.ts` の同更新
- ホーム フィルタ ( セグメント )
- 詳細 / 一覧の REPLICA バッジ

実装が固まった段階で別途 viewer 同期指示書を書く。

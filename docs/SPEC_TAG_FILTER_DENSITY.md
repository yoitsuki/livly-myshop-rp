# 仕様書 — ホーム タグフィルタの密度改善

## 背景

`/` (ホーム) のタグフィルタは v0.16.0 で `TYPE_LABEL` 見出し付きの
セクション化、v0.16.3 で件数表示 + 0 件タグの非表示、までで止まっている。

SEED 58 件の 7 種類体制になってアクティブタグが多くなると、ファースト
ビューがチップで埋まり、本体のアイテム一覧が下に押し下げられる問題が
残っている。

## 方針 ( 採用案 )

**セクションを折り畳み可能にし、デフォルトは全部閉じる**。
ただし以下のセクションは自動展開する:

- 現在選択中 ( `activeTagIds` に少なくとも 1 件含む ) のタグがあるセクション

これにより:

- 初回訪問: 7 行 ( セクションヘッダのみ ) で済む
- フィルタ操作中: 関連セクションが開いていて操作を継続できる
- 解除すると自動で閉じる ( `activeTagIds` 空になったら )

## UI

### セクションヘッダ ( 既存スタイルを拡張 )

折り畳みボタン化。タップ可能、右端に `▾` / `▸` 矢印 + 件数サマリ。

```tsx
<button
  onClick={() => toggleSection(type)}
  aria-expanded={isOpen}
  className="w-full flex items-center justify-between px-1 py-1.5"
>
  <span
    className="text-[10px] font-medium tracking-[0.18em] uppercase text-[var(--color-muted)]"
    style={{ fontFamily: "var(--font-label)" }}
  >
    {TYPE_LABEL[type]}
  </span>
  <span
    className="text-[10px] tabular-nums text-[var(--color-muted)] flex items-center gap-1"
    style={{ fontFamily: "var(--font-label)", letterSpacing: "0.08em" }}
  >
    {activeInThisSection > 0 && (
      <span className="text-[var(--color-gold-deep)]">
        {activeInThisSection} ON
      </span>
    )}
    <span>{group.length} 種</span>
    <ChevronDown
      size={12}
      strokeWidth={1.8}
      className={`transition-transform duration-150 ${isOpen ? "" : "-rotate-90"}`}
    />
  </span>
</button>
```

折り畳み時: `▸ ` ( 90° rotate )、展開時: `▾`。
( DrawerNav でも同じ ChevronRight rotate-90 パターンを使っているので統一感あり )

### 展開時のチップ列 ( 既存のままで OK )

`isOpen` が真のときだけ既存の `flex gap-1.5 flex-wrap` のチップ列を描画。

## 実装

### state

セクションごとの開閉を `Record<TagType, boolean>` で管理。
ただしユーザーが触っていない間は **派生 ( derived ) で良い** —
`activeTagIds` を見て自動で計算される値。

明示的にトグルしたら手動オーバーライド state に書き、`activeTagIds`
が変わったらリセット、というパターンが UX 的に自然。

簡単版 (推奨):

```tsx
// 明示的に toggle した記録
const [manualOpen, setManualOpen] = useState<Partial<Record<TagType, boolean>>>({});

const isOpen = (type: TagType) => {
  // 1. 手動で toggle されていたらその値
  if (manualOpen[type] !== undefined) return manualOpen[type];
  // 2. このセクション内に active がいれば自動展開
  return tags!.some((t) => t.type === type && activeTagIds.includes(t.id));
};

const toggleSection = (type: TagType) => {
  setManualOpen((prev) => ({
    ...prev,
    [type]: !isOpen(type),
  }));
};

// activeTagIds がリセットされたら manualOpen も全消し
useEffect(() => {
  if (activeTagIds.length === 0) setManualOpen({});
}, [activeTagIds]);
```

### 描画箇所 ( `src/app/page.tsx` )

既存の `TYPE_ORDER.map((type) => { ... })` の中身を変更:

```tsx
{TYPE_ORDER.map((type) => {
  const group = tags.filter(
    (t) =>
      t.type === type &&
      ((tagUsage.get(t.id) ?? 0) > 0 || activeTagIds.includes(t.id)),
  );
  if (group.length === 0) return null;

  const open = isOpen(type);
  const activeInThisSection = group.filter((t) =>
    activeTagIds.includes(t.id),
  ).length;

  return (
    <section key={type} className="space-y-1">
      <button
        onClick={() => toggleSection(type)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-1 py-1.5 hover:bg-[var(--color-line-soft)]"
      >
        {/* 上記の見出し JSX */}
      </button>
      {open && (
        <div className="flex gap-1.5 flex-wrap">
          {group.map((t) => {
            // 既存のチップ JSX をそのまま使う
          })}
        </div>
      )}
    </section>
  );
})}
```

## アクセシビリティ

- `aria-expanded` を必ず付ける
- 折り畳みボタン自体に `aria-controls` で展開部分を紐付けたいなら id も振る

## キーボード

- フォーカスしてエンターで開閉 ( `<button>` なのでデフォルトで OK )
- 矢印キーでのセクション間移動は v1 では入れない

## アニメーション

最小限。`ChevronDown` の rotate transition のみ、チップ列の開閉は瞬時。
height アニメーションは `flex-wrap` と相性が悪いので避ける。

## 受け入れ条件

1. 初回訪問時: 全セクション折り畳まれた状態 ( 7 行のみ )
2. タグを 1 つタップ → そのセクションが自動展開 + 他は閉じたまま
3. 別セクションのヘッダをタップ → そのセクションも展開
4. ヘッダ再タップ → 閉じる ( 中の active タグは選択中のまま )
5. すべてのフィルタを解除 ( タグも検索も ) → 全セクション折り畳まれた状態に戻る
6. セクションヘッダ右端のサマリは `[N ON] [M 種] [▾]` 形式 ( ON は 0 のとき省略 )

## 実装手順

1. `src/app/page.tsx` に `manualOpen` state + `isOpen` / `toggleSection` ロジック
2. `useEffect` で `activeTagIds` 空 → `manualOpen` リセット
3. 既存の `<section>` JSX を上記の折り畳み版に置き換え
4. `lucide-react` から `ChevronDown` を import
5. build 確認 → 実機で密度確認
6. `src/lib/version.ts` に bump コメント
7. commit → push

## バージョン

`0.18.x` ( レプリカと同じ minor の中で `.1` / `.2` で別出し、もしくは同じリリースに同梱 )。
レプリカが大きいので 2 つに分けて出すのが安全。

## viewer 同期

viewer のホームにも同じタグフィルタがあれば同期が必要。
状態 / 描画ロジックを丸ごと移植する。

## デザイン上の注意

- 7 セクション全部閉じても、見出しだけで縦に 7 行使うので、ファースト
  ビューはまだそれなりに長い。**セクション間の余白を詰める** か、
  `space-y-2.5` を `space-y-1.5` に詰める検討余地あり ( 実機で要確認 )
- 「もっと見る」「pin 表示」案は今回の範囲外。折り畳みだけで足りなければ
  次のラウンドで追加する

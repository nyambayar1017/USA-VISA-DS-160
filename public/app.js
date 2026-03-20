<!DOCTYPE html>
<html lang="mn">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Визийн маягтын хариултууд</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">АДМИН</p>
        <h1>Визийн маягтын илгээсэн хариултууд</h1>
        <p class="intro">
          Монгол үйлчлүүлэгчдийн бөглөсөн бүх мэдээллийг эндээс харж, CSV-аар татаж авч болно.
        </p>
      </section>

      <section class="card">
        <div class="dashboard-head">
          <h2>Илгээсэн мэдээллүүд</h2>
          <div class="dashboard-actions">
            <button id="export-button" type="button">CSV татах</button>
            <button id="refresh-button" type="button">Шинэчлэх</button>
          </div>
        </div>
        <p class="helper">Админ токеноо оруулж мэдээллээ нээнэ үү.</p>
        <div class="token-row">
          <input id="admin-token" type="password" placeholder="Админ токен" />
        </div>
        <div id="submission-list" class="submission-list"></div>
      </section>
    </main>

    <script src="/admin.js"></script>
  </body>
</html>

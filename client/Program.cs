using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace NatureScreensaver;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        var baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NatureScreensaver");
        Directory.CreateDirectory(baseDir);
        try 
        { 
            File.AppendAllText(Path.Combine(baseDir, "sync.log"), $"[{DateTime.Now}] Main started. Mode: {(args.Length > 0 ? args[0] : "none")} (Args: {string.Join(" ", args)})\n"); 
        } 
        catch {}

        ApplicationConfiguration.Initialize();
        var mode = args.Length > 0 ? args[0].ToLowerInvariant() : "/s";
        
        // 설정 창 또는 정보 표시 (/c)
        if (mode.StartsWith("/c"))
        {
            var settingsPath = Path.Combine(baseDir, "settings.json");
            var lastConfigPath = Path.Combine(baseDir, "last-config.json");
            var logPath = Path.Combine(baseDir, "sync.log");
            var settingsText = File.Exists(settingsPath) ? File.ReadAllText(settingsPath) : "없음";
            var lastConfigText = File.Exists(lastConfigPath) ? File.ReadAllText(lastConfigPath) : "없음";
            var logText = File.Exists(logPath) ? File.ReadAllText(logPath) : "로그 없음";
            if (logText.Length > 400) logText = logText.Substring(logText.Length - 400);

            MessageBox.Show($"[네이처 화면보호기 상태]\n\n● 설정 파일 (settings.json):\n{settingsText}\n\n● 최근 로그:\n{logText}", "네이처 화면보호기 정보");
            return;
        }

        // 화면보호기 미리보기 창 (/p <hwnd>)
        if (mode.StartsWith("/p"))
        {
            var parent = args.Length > 1 && long.TryParse(args[1], out var handle) ? new IntPtr(handle) : IntPtr.Zero;
            Application.Run(new ScreensaverForm(Screen.PrimaryScreen, true, parent));
            return;
        }

        // 다중 모니터 대응: 연결된 모든 화면에 개별 화면보호기 창 생성
        var screens = Screen.AllScreens;
        if (screens.Length == 0)
        {
            Application.Run(new ScreensaverForm(Screen.PrimaryScreen, true));
            return;
        }

        foreach (var screen in screens)
        {
            var isPrimary = screen.Primary;
            var form = new ScreensaverForm(screen, isPrimary);
            form.Show();
        }

        Application.Run();
    }
}

public sealed class ScreensaverForm : Form
{
    private readonly System.Windows.Forms.Timer _slideTimer = new();
    private readonly System.Windows.Forms.Timer _syncTimer = new();
    private readonly System.Windows.Forms.Timer _animTimer = new();
    private readonly System.Windows.Forms.Timer _clockTimer = new();

    private readonly string _baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NatureScreensaver");
    private readonly string _cacheDir;
    private readonly IntPtr _previewParent;
    private readonly Screen _screen;
    private readonly bool _isPrimary;

    private Config _config = Config.Default();
    private List<SlideItem> _slideItems = [];
    private int _index = -1;
    private Point _startMouse;

    // 크로스페이드(Cross-Fade) 전환용 이미지 및 알파 값
    private Image? _currentImage;
    private Image? _nextImage;
    private float _transitionProgress = 1.0f; // 0.0f ~ 1.0f (1.0f = 전환 완료)

    public ScreensaverForm(Screen? screen = null, bool isPrimary = true, IntPtr previewParent = default)
    {
        _screen = screen ?? Screen.PrimaryScreen ?? Screen.AllScreens.FirstOrDefault()!;
        _isPrimary = isPrimary;
        _previewParent = previewParent;
        _cacheDir = Path.Combine(_baseDir, "cache");
        Directory.CreateDirectory(_cacheDir);

        // 더블 버퍼링 설정 (부드러운 페이드인/아웃 렌더링 및 깜빡임 방지)
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
        UpdateStyles();

        FormBorderStyle = FormBorderStyle.None;
        BackColor = Color.Black;

        if (_previewParent == IntPtr.Zero)
        {
            StartPosition = FormStartPosition.Manual;
            Bounds = _screen.Bounds;
            WindowState = FormWindowState.Normal;
            TopMost = true;
            ShowInTaskbar = false;
            Cursor.Hide();
        }
        else
        {
            WindowState = FormWindowState.Normal;
        }

        var startTime = DateTime.UtcNow;
        if (_previewParent == IntPtr.Zero)
        {
            KeyDown += (_, _) => { if ((DateTime.UtcNow - startTime).TotalMilliseconds > 1000) Application.Exit(); };
            MouseDown += (_, _) => { if ((DateTime.UtcNow - startTime).TotalMilliseconds > 1000) Application.Exit(); };
            MouseMove += (_, e) => {
                if ((DateTime.UtcNow - startTime).TotalMilliseconds > 1500 && _startMouse != Point.Empty && Distance(_startMouse, e.Location) > 20)
                {
                    Application.Exit();
                }
            };
        }

        Load += async (_, _) => {
            AttachPreviewWindow();
            if (_previewParent != IntPtr.Zero)
            {
                await SyncAndStart();
            }
        };

        Shown += async (_, _) => {
            _startMouse = PointToClient(Cursor.Position);
            if (_previewParent == IntPtr.Zero)
            {
                await SyncAndStart();
            }
        };

        // 타이머 이벤트 등록
        _slideTimer.Tick += (_, _) => ShowNext();
        _animTimer.Interval = 20; // 약 50fps
        _animTimer.Tick += (_, _) => UpdateAnimation();

        _clockTimer.Interval = 1000;
        _clockTimer.Tick += (_, _) => Invalidate(); // 1초마다 시계 오버레이 갱신

        if (_isPrimary)
        {
            _syncTimer.Tick += async (_, _) => await SyncAndStart(false);
        }
    }

    private void UpdateAnimation()
    {
        _transitionProgress += 0.05f; // 약 400ms 동안 0.0 -> 1.0 도달
        if (_transitionProgress >= 1.0f)
        {
            _transitionProgress = 1.0f;
            _animTimer.Stop();

            var old = _currentImage;
            _currentImage = _nextImage;
            _nextImage = null;
            old?.Dispose();
        }
        Invalidate();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var g = e.Graphics;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.SmoothingMode = SmoothingMode.HighQuality;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;

        // 배경색
        Color bgColor = Color.Black;
        try 
        {
            if (!string.IsNullOrWhiteSpace(_config.BackgroundColor)) 
                bgColor = ColorTranslator.FromHtml(_config.BackgroundColor);
        }
        catch {}
        using (var bgBrush = new SolidBrush(bgColor))
        {
            g.FillRectangle(bgBrush, ClientRectangle);
        }

        // 1. 현재 슬라이드 그리기
        if (_currentImage != null)
        {
            DrawFitImage(g, _currentImage, 1.0f);
        }

        // 2. 크로스페이드 중인 다음 슬라이드 알파 블렌딩 그리기
        if (_nextImage != null && _transitionProgress < 1.0f)
        {
            DrawFitImage(g, _nextImage, _transitionProgress);
        }

        // 이미지가 아예 없을 때 안내문
        if (_currentImage == null && _nextImage == null)
        {
            using var font = new Font("Malgun Gothic", 16, FontStyle.Regular);
            using var brush = new SolidBrush(Color.FromArgb(160, 255, 255, 255));
            var text = "네이처 화면보호기 슬라이드를 동기화하고 있습니다...";
            var size = g.MeasureString(text, font);
            g.DrawString(text, font, brush, (Width - size.Width) / 2, (Height - size.Height) / 2);
        }

        // 3. 하단 모던 글래스모피즘 상태 바 렌더링 (미리보기가 아닐 때만 렌더링)
        if (_previewParent == IntPtr.Zero)
        {
            DrawModernOverlayBar(g);
        }
    }

    private void DrawFitImage(Graphics g, Image img, float alpha)
    {
        var targetRect = ClientRectangle;
        if (targetRect.Width <= 0 || targetRect.Height <= 0) return;

        // 종횡비 유지 (Contain 모드)
        float imgRatio = (float)img.Width / img.Height;
        float screenRatio = (float)targetRect.Width / targetRect.Height;

        int drawWidth, drawHeight, drawX, drawY;
        if (screenRatio > imgRatio)
        {
            drawHeight = targetRect.Height;
            drawWidth = (int)(drawHeight * imgRatio);
            drawX = targetRect.X + (targetRect.Width - drawWidth) / 2;
            drawY = targetRect.Y;
        }
        else
        {
            drawWidth = targetRect.Width;
            drawHeight = (int)(drawWidth / imgRatio);
            drawX = targetRect.X;
            drawY = targetRect.Y + (targetRect.Height - drawHeight) / 2;
        }

        var destRect = new Rectangle(drawX, drawY, drawWidth, drawHeight);

        if (alpha >= 0.99f)
        {
            g.DrawImage(img, destRect);
        }
        else
        {
            var cm = new ColorMatrix { Matrix33 = Math.Clamp(alpha, 0.0f, 1.0f) };
            using var ia = new ImageAttributes();
            ia.SetColorMatrix(cm, ColorMatrixFlag.Default, ColorAdjustType.Bitmap);
            g.DrawImage(img, destRect, 0, 0, img.Width, img.Height, GraphicsUnit.Pixel, ia);
        }
    }

    private void DrawModernOverlayBar(Graphics g)
    {
        int barHeight = 44;
        var barRect = new Rectangle(0, Height - barHeight, Width, barHeight);

        // 반투명 다크 글래스 바
        using (var barBrush = new SolidBrush(Color.FromArgb(170, 10, 15, 20)))
        {
            g.FillRectangle(barBrush, barRect);
        }
        using (var borderPen = new Pen(Color.FromArgb(40, 255, 255, 255), 1))
        {
            g.DrawLine(borderPen, 0, Height - barHeight, Width, Height - barHeight);
        }

        using var fontTime = new Font("Malgun Gothic", 10.5f, FontStyle.Bold);
        using var fontNotice = new Font("Malgun Gothic", 11.5f, FontStyle.Bold);
        using var fontDDay = new Font("Malgun Gothic", 10.5f, FontStyle.Bold);
        using var textBrush = new SolidBrush(Color.White);
        using var subBrush = new SolidBrush(Color.FromArgb(200, 220, 230));

        // 1. 좌측: 실시간 시계 & 날짜
        var now = DateTime.Now;
        var timeStr = now.ToString("yyyy.MM.dd (ddd)  HH:mm:ss");
        g.DrawString(timeStr, fontTime, subBrush, 24, Height - barHeight + 12);

        // 2. 우측: D-Day 배지 (설정된 경우)
        int rightOffset = Width - 24;
        if (!string.IsNullOrWhiteSpace(_config.DDayDate) && DateTime.TryParse(_config.DDayDate, out var targetDate))
        {
            var days = (targetDate.Date - DateTime.Today).Days;
            var ddayText = days == 0 ? "D-Day" : (days > 0 ? $"D-{days}" : $"D+{Math.Abs(days)}");
            var fullBadgeText = string.IsNullOrWhiteSpace(_config.DDayTitle) 
                ? $"🌿 {ddayText}" 
                : $"🌿 {_config.DDayTitle}  {ddayText}";

            var badgeSize = g.MeasureString(fullBadgeText, fontDDay);
            int badgeW = (int)badgeSize.Width + 24;
            int badgeH = 28;
            int badgeX = rightOffset - badgeW;
            int badgeY = Height - barHeight + (barHeight - badgeH) / 2;

            using (var badgeBg = new SolidBrush(Color.FromArgb(220, 16, 185, 129))) // 에메랄드 테마
            {
                g.FillRoundedRectangle(badgeBg, new Rectangle(badgeX, badgeY, badgeW, badgeH), 6);
            }
            g.DrawString(fullBadgeText, fontDDay, textBrush, badgeX + 12, badgeY + 4);
            rightOffset = badgeX - 20;
        }

        // 3. 중앙: 공지 문구
        var noticeText = !string.IsNullOrWhiteSpace(_config.Notice) 
            ? _config.Notice 
            : "네이처 요양병원 의료기관 인증평가 대비 원내 공지";

        var noticeSize = g.MeasureString(noticeText, fontNotice);
        float noticeX = (Width - noticeSize.Width) / 2;
        if (noticeX > 220 && noticeX + noticeSize.Width < rightOffset)
        {
            g.DrawString(noticeText, fontNotice, textBrush, noticeX, Height - barHeight + 11);
        }
    }

    private async Task SyncAndStart(bool startTimers = true)
    {
        await LoadLastConfig();
        RefreshImageList();
        ApplyConfigToTimers();

        if (startTimers)
        {
            ShowNext();
            _slideTimer.Start();
            _clockTimer.Start();
            if (_isPrimary) _syncTimer.Start();
        }

        if (!_isPrimary) return;

        var logPath = Path.Combine(_baseDir, "sync.log");
        try
        {
            var settings = await LoadLocalSettings();
            await File.AppendAllTextAsync(logPath, $"[{DateTime.Now}] Sync started. ConfigUrl: {settings.ConfigUrl}\n");
            
            if (!string.IsNullOrWhiteSpace(settings.ConfigUrl))
            {
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(25) };
                http.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) NatureScreensaver/2.0");
                http.DefaultRequestHeaders.CacheControl = new System.Net.Http.Headers.CacheControlHeaderValue { NoCache = true, NoStore = true, MustRevalidate = true };
                
                var cacheBustUrl = settings.ConfigUrl.Contains('?') 
                    ? $"{settings.ConfigUrl}&_cb={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}" 
                    : $"{settings.ConfigUrl}?_cb={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
                    
                var remote = await http.GetFromJsonAsync<Config>(cacheBustUrl);
                await File.AppendAllTextAsync(logPath, $"[{DateTime.Now}] Remote fetched. Version: {remote?.Version}, Slides: {remote?.Slides?.Count}\n");
                
                if (remote?.Slides?.Count > 0 && ShouldDownload(remote))
                {
                    await File.AppendAllTextAsync(logPath, $"[{DateTime.Now}] Starting DownloadSlides...\n");
                    await DownloadSlides(http, remote);
                    _config = remote;
                    await WriteJson(Path.Combine(_baseDir, "last-config.json"), remote);
                    RefreshImageList();
                    ApplyConfigToTimers();
                    await File.AppendAllTextAsync(logPath, $"[{DateTime.Now}] DownloadSlides finished. Images count: {_slideItems.Count}\n");
                    _index = -1;
                    ShowNext();
                }

                // 백그라운드 하트비트 전송 (원내 PC 관제용 핑)
                _ = SendHeartbeatAsync(settings.ConfigUrl, remote?.Version ?? _config.Version);
            }
        }
        catch (Exception ex)
        {
            await File.AppendAllTextAsync(logPath, $"[{DateTime.Now}] SYNC ERROR: {ex}\n");
            RefreshImageList();
            if (_currentImage == null) ShowNext();
        }
    }

    private async Task SendHeartbeatAsync(string configUrl, string currentVersion)
    {
        try
        {
            var uri = new Uri(configUrl);
            var heartbeatUrl = $"{uri.Scheme}://{uri.Authority}/api/heartbeat";
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
            var payload = new
            {
                machineName = Environment.MachineName,
                userName = Environment.UserName,
                screenCount = Screen.AllScreens.Length,
                version = currentVersion,
                slidesCount = _slideItems.Count,
                os = Environment.OSVersion.VersionString
            };
            await client.PostAsJsonAsync(heartbeatUrl, payload);
        }
        catch 
        {
            // 하트비트 실패 시 화면보호기 동작에 일체 지장 없음
        }
    }

    private async Task LoadLastConfig()
    {
        var last = Path.Combine(_baseDir, "last-config.json");
        if (File.Exists(last)) _config = await ReadJson<Config>(last) ?? _config;
    }

    private bool ShouldDownload(Config remote)
    {
        if (remote.Version != _config.Version) return true;
        return remote.Slides.Any(s => !File.Exists(Path.Combine(_cacheDir, s.FileName)));
    }

    private void RefreshImageList()
    {
        var validExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg", ".webp" };
        var list = new List<SlideItem>();

        if (_config?.Slides?.Count > 0)
        {
            foreach (var slide in _config.Slides.OrderBy(s => s.Order))
            {
                if (string.IsNullOrWhiteSpace(slide.FileName)) continue;
                var filePath = Path.Combine(_cacheDir, slide.FileName);
                if (File.Exists(filePath))
                {
                    list.Add(new SlideItem 
                    { 
                        FilePath = filePath, 
                        DurationSeconds = slide.DurationSeconds ?? _config.SlideDurationSeconds 
                    });
                }
            }
        }

        if (list.Count == 0)
        {
            var files = Directory.GetFiles(_cacheDir)
                .Where(f => validExts.Contains(Path.GetExtension(f)))
                .OrderBy(Path.GetFileName);

            foreach (var f in files)
            {
                list.Add(new SlideItem { FilePath = f, DurationSeconds = _config.SlideDurationSeconds });
            }
        }

        _slideItems = list;
    }

    private void ApplyConfigToTimers()
    {
        _syncTimer.Interval = Math.Max(1, _config.UpdateIntervalMinutes) * 60 * 1000;
    }

    private void ShowNext()
    {
        if (_slideItems.Count == 0) RefreshImageList();
        if (_slideItems.Count == 0) return;

        _index = (_index + 1) % _slideItems.Count;
        var item = _slideItems[_index];

        try
        {
            var bytes = File.ReadAllBytes(item.FilePath);
            using var ms = new MemoryStream(bytes);
            var loaded = Image.FromStream(ms);

            // 다음 슬라이드 재생 시간 적용 (개별 슬라이드 설정 우선)
            int duration = Math.Max(3, item.DurationSeconds > 0 ? item.DurationSeconds : _config.SlideDurationSeconds);
            _slideTimer.Interval = duration * 1000;

            // 크로스페이드 트랜지션 시작
            if (_currentImage == null)
            {
                _currentImage = loaded;
                _transitionProgress = 1.0f;
                Invalidate();
            }
            else
            {
                _nextImage?.Dispose();
                _nextImage = loaded;
                _transitionProgress = 0.0f;
                _animTimer.Start();
            }
        }
        catch
        {
            // 파일 로드 실패 시 안전하게 넘어감
        }
    }

    private async Task<LocalSettings> LoadLocalSettings()
    {
        var path = Path.Combine(_baseDir, "settings.json");
        if (!File.Exists(path))
        {
            var settings = LocalSettings.Default();
            await WriteJson(path, settings);
            return settings;
        }
        var loaded = await ReadJson<LocalSettings>(path) ?? LocalSettings.Default();
        if (string.IsNullOrWhiteSpace(loaded.ConfigUrl) || loaded.ConfigUrl.Contains("drive.google.com/uc?export=download&id=11piOInshLojKHr20k9AdROicAHiLQADf"))
        {
            loaded.ConfigUrl = "https://nature-screensaver.vercel.app/config.json";
            await WriteJson(path, loaded);
        }
        return loaded;
    }

    private async Task DownloadSlides(HttpClient http, Config config)
    {
        var temp = Path.Combine(_baseDir, "download");
        if (Directory.Exists(temp)) Directory.Delete(temp, true);
        Directory.CreateDirectory(temp);

        foreach (var slide in config.Slides.OrderBy(s => s.Order))
        {
            if (string.IsNullOrWhiteSpace(slide.Url) || string.IsNullOrWhiteSpace(slide.FileName)) continue;
            var bytes = await http.GetByteArrayAsync(slide.Url);
            var safeName = string.Concat(slide.FileName.Split(Path.GetInvalidFileNameChars()));
            await File.WriteAllBytesAsync(Path.Combine(temp, safeName), bytes);
        }

        foreach (var file in Directory.GetFiles(_cacheDir))
        {
            try { File.Delete(file); } catch {}
        }

        foreach (var file in Directory.GetFiles(temp))
        {
            try { File.Move(file, Path.Combine(_cacheDir, Path.GetFileName(file)), true); } catch {}
        }

        try { Directory.Delete(temp, true); } catch {}
    }

    private void AttachPreviewWindow()
    {
        if (_previewParent == IntPtr.Zero) return;
        SetParent(Handle, _previewParent);
        GetClientRect(_previewParent, out var rect);
        Bounds = new Rectangle(0, 0, rect.Right - rect.Left, rect.Bottom - rect.Top);
    }

    private static async Task<T?> ReadJson<T>(string path)
    {
        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<T>(stream);
    }

    private static async Task WriteJson<T>(string path, T value)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var stream = File.Create(path);
        await JsonSerializer.SerializeAsync(stream, value, new JsonSerializerOptions { WriteIndented = true });
    }

    private static double Distance(Point a, Point b)
    {
        var dx = a.X - b.X;
        var dy = a.Y - b.Y;
        return Math.Sqrt(dx * dx + dy * dy);
    }

    [DllImport("user32.dll")]
    private static extern IntPtr SetParent(IntPtr child, IntPtr newParent);

    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}

public static class GraphicsExtensions
{
    public static void FillRoundedRectangle(this Graphics g, Brush brush, Rectangle bounds, int cornerRadius)
    {
        using var path = CreateRoundedRectanglePath(bounds, cornerRadius);
        g.FillPath(brush, path);
    }

    private static GraphicsPath CreateRoundedRectanglePath(Rectangle bounds, int radius)
    {
        var path = new GraphicsPath();
        int diameter = radius * 2;
        var arc = new Rectangle(bounds.Location, new Size(diameter, diameter));

        path.AddArc(arc, 180, 90);
        arc.X = bounds.Right - diameter;
        path.AddArc(arc, 270, 90);
        arc.Y = bounds.Bottom - diameter;
        path.AddArc(arc, 0, 90);
        arc.X = bounds.Left;
        path.AddArc(arc, 90, 90);
        path.CloseFigure();
        return path;
    }
}

public sealed class SlideItem
{
    public string FilePath { get; set; } = "";
    public int DurationSeconds { get; set; } = 15;
}

public sealed class LocalSettings
{
    [JsonPropertyName("configUrl")] public string ConfigUrl { get; set; } = "https://nature-screensaver.vercel.app/config.json";
    public static LocalSettings Default() => new();
}

public sealed class Config
{
    [JsonPropertyName("version")] public string Version { get; set; } = "local";
    [JsonPropertyName("updateIntervalMinutes")] public int UpdateIntervalMinutes { get; set; } = 10;
    [JsonPropertyName("slideDurationSeconds")] public int SlideDurationSeconds { get; set; } = 15;
    [JsonPropertyName("backgroundColor")] public string BackgroundColor { get; set; } = "#050505";
    [JsonPropertyName("fitMode")] public string FitMode { get; set; } = "contain";
    [JsonPropertyName("notice")] public string Notice { get; set; } = "";
    [JsonPropertyName("dDayTitle")] public string? DDayTitle { get; set; } = "4주기 인증평가";
    [JsonPropertyName("dDayDate")] public string? DDayDate { get; set; }
    [JsonPropertyName("slides")] public List<Slide> Slides { get; set; } = [];
    public static Config Default() => new();
}

public sealed class Slide
{
    [JsonPropertyName("order")] public int Order { get; set; }
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("fileName")] public string FileName { get; set; } = "";
    [JsonPropertyName("url")] public string Url { get; set; } = "";
    [JsonPropertyName("durationSeconds")] public int? DurationSeconds { get; set; }
}

using System.Drawing;
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
        ApplicationConfiguration.Initialize();
        var mode = args.Length > 0 ? args[0].ToLowerInvariant() : "/s";
        if (mode.StartsWith("/c"))
        {
            MessageBox.Show("Nature Screensaver settings are controlled by config.json.", "Nature Screensaver");
            return;
        }
        if (mode.StartsWith("/p"))
        {
            var parent = args.Length > 1 && long.TryParse(args[1], out var handle) ? new IntPtr(handle) : IntPtr.Zero;
            Application.Run(new ScreensaverForm(Screen.PrimaryScreen, true, parent));
            return;
        }

        // 듀얼/다중 모니터 감지: 연결된 모든 화면에 개별 화면보호기 창 생성
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
    private readonly PictureBox _picture = new() { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom, BackColor = Color.Black };
    private readonly Label _notice = new() { Dock = DockStyle.Bottom, Height = 36, TextAlign = ContentAlignment.MiddleCenter, ForeColor = Color.White, BackColor = Color.FromArgb(120, 0, 0, 0) };
    private readonly System.Windows.Forms.Timer _slideTimer = new();
    private readonly System.Windows.Forms.Timer _syncTimer = new();
    private readonly string _baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NatureScreensaver");
    private readonly string _cacheDir;
    private readonly IntPtr _previewParent;
    private readonly Screen _screen;
    private readonly bool _isPrimary;
    private Config _config = Config.Default();
    private List<string> _images = [];
    private int _index = -1;
    private Point _startMouse;

    public ScreensaverForm(Screen? screen = null, bool isPrimary = true, IntPtr previewParent = default)
    {
        _screen = screen ?? Screen.PrimaryScreen ?? Screen.AllScreens.FirstOrDefault()!;
        _isPrimary = isPrimary;
        _previewParent = previewParent;
        _cacheDir = Path.Combine(_baseDir, "cache");
        Directory.CreateDirectory(_cacheDir);
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

        Controls.Add(_picture);
        Controls.Add(_notice);

        // 어느 모니터에서든 사용자 입력(키보드/마우스) 발생 시 모든 화면보호기 창 일괄 종료
        KeyDown += (_, _) => Application.Exit();
        MouseDown += (_, _) => Application.Exit();
        MouseMove += (_, e) => { if (_startMouse != Point.Empty && Distance(_startMouse, e.Location) > 8) Application.Exit(); };
        Load += (_, _) => AttachPreviewWindow();
        Shown += async (_, _) => { _startMouse = PointToClient(Cursor.Position); await SyncAndStart(); };
        _slideTimer.Tick += (_, _) => ShowNext();
        if (_isPrimary)
        {
            _syncTimer.Tick += async (_, _) => await SyncAndStart(false);
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
            if (_isPrimary) _syncTimer.Start();
        }

        // 다운로드는 주 모니터 폼에서만 수행하여 파일 동시쓰기 충돌 방지
        if (!_isPrimary) return;

        try
        {
            var settings = await LoadLocalSettings();
            if (!string.IsNullOrWhiteSpace(settings.ConfigUrl))
            {
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
                var remote = await http.GetFromJsonAsync<Config>(settings.ConfigUrl);
                if (remote?.Slides?.Count > 0 && ShouldDownload(remote))
                {
                    await DownloadSlides(http, remote);
                    _config = remote;
                    await WriteJson(Path.Combine(_baseDir, "last-config.json"), remote);
                    RefreshImageList();
                    ApplyConfigToTimers();
                    if (_picture.Image == null) ShowNext();
                }
            }
        }
        catch
        {
            RefreshImageList();
            if (_picture.Image == null) ShowNext();
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
        var validExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg" };
        _images = Directory.GetFiles(_cacheDir)
            .Where(f => validExts.Contains(Path.GetExtension(f)))
            .OrderBy(Path.GetFileName)
            .ToList();
    }

    private void ApplyConfigToTimers()
    {
        _notice.Text = string.IsNullOrWhiteSpace(_config.Notice) ? "Nature Screensaver" : _config.Notice;
        _slideTimer.Interval = Math.Max(5, _config.SlideDurationSeconds) * 1000;
        _syncTimer.Interval = Math.Max(5, _config.UpdateIntervalMinutes) * 60 * 1000;
    }

    private void AttachPreviewWindow()
    {
        if (_previewParent == IntPtr.Zero) return;
        SetParent(Handle, _previewParent);
        GetClientRect(_previewParent, out var rect);
        Bounds = new Rectangle(0, 0, rect.Right - rect.Left, rect.Bottom - rect.Top);
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
        foreach (var file in Directory.GetFiles(_cacheDir)) File.Delete(file);
        foreach (var file in Directory.GetFiles(temp)) File.Move(file, Path.Combine(_cacheDir, Path.GetFileName(file)), true);
        Directory.Delete(temp, true);
    }

    private void ShowNext()
    {
        if (_images.Count == 0) RefreshImageList();

        if (_images.Count == 0)
        {
            _picture.Image = null;
            _notice.Text = "Screensaver images have not been downloaded yet.";
            return;
        }

        _index = (_index + 1) % _images.Count;
        try
        {
            var bytes = File.ReadAllBytes(_images[_index]);
            using var ms = new MemoryStream(bytes);
            var next = Image.FromStream(ms);
            var old = _picture.Image;
            _picture.Image = next;
            old?.Dispose();
        }
        catch
        {
            // 파일 갱신 타이밍 등으로 읽기 실패 시 안전하게 무시
        }
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

public sealed class LocalSettings
{
    [JsonPropertyName("configUrl")] public string ConfigUrl { get; set; } = "https://nature-screensaver.vercel.app/config.json";
    public static LocalSettings Default() => new();
}

public sealed class Config
{
    [JsonPropertyName("version")] public string Version { get; set; } = "local";
    [JsonPropertyName("updateIntervalMinutes")] public int UpdateIntervalMinutes { get; set; } = 60;
    [JsonPropertyName("slideDurationSeconds")] public int SlideDurationSeconds { get; set; } = 20;
    [JsonPropertyName("notice")] public string Notice { get; set; } = "";
    [JsonPropertyName("slides")] public List<Slide> Slides { get; set; } = [];
    public static Config Default() => new();
}

public sealed class Slide
{
    [JsonPropertyName("order")] public int Order { get; set; }
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("fileName")] public string FileName { get; set; } = "";
    [JsonPropertyName("url")] public string Url { get; set; } = "";
}

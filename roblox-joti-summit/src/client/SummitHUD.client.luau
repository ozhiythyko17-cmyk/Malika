-- Tampilan layar pemain: judul acara, posisi + waktu pendakian,
-- banner pengumuman, dan tombol kembali ke Basecamp.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage:WaitForChild("SummitShared"):WaitForChild("Config"))
local remotes = ReplicatedStorage:WaitForChild("SummitRemotes")
local announceEvent = remotes:WaitForChild("Announce")
local basecampEvent = remotes:WaitForChild("ToBasecamp")

local player = Players.LocalPlayer

local gui = Instance.new("ScreenGui")
gui.Name = "SummitHUD"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = false
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(parent, radius)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or 10)
	c.Parent = parent
end

-- Panel status (kiri atas, di bawah tombol menu Roblox)
local panel = Instance.new("Frame")
panel.Name = "Status"
panel.Position = UDim2.new(0, 12, 0, 12)
panel.Size = UDim2.fromOffset(250, 78)
panel.BackgroundColor3 = Color3.fromRGB(40, 28, 15)
panel.BackgroundTransparency = 0.2
panel.Parent = gui
corner(panel)

local title = Instance.new("TextLabel")
title.Position = UDim2.fromOffset(10, 4)
title.Size = UDim2.new(1, -20, 0, 22)
title.BackgroundTransparency = 1
title.Text = Config.EVENT_NAME .. " • " .. Config.ORGANIZER
title.TextColor3 = Config.COLORS.Checkpoint
title.Font = Enum.Font.GothamBlack
title.TextScaled = true
title.TextXAlignment = Enum.TextXAlignment.Left
title.Parent = panel

local posLabel = Instance.new("TextLabel")
posLabel.Position = UDim2.fromOffset(10, 28)
posLabel.Size = UDim2.new(1, -20, 0, 24)
posLabel.BackgroundTransparency = 1
posLabel.TextColor3 = Color3.new(1, 1, 1)
posLabel.Font = Enum.Font.GothamBold
posLabel.TextScaled = true
posLabel.TextXAlignment = Enum.TextXAlignment.Left
posLabel.Parent = panel

local timeLabel = Instance.new("TextLabel")
timeLabel.Position = UDim2.fromOffset(10, 52)
timeLabel.Size = UDim2.new(1, -20, 0, 20)
timeLabel.BackgroundTransparency = 1
timeLabel.TextColor3 = Color3.fromRGB(220, 220, 220)
timeLabel.Font = Enum.Font.Gotham
timeLabel.TextScaled = true
timeLabel.TextXAlignment = Enum.TextXAlignment.Left
timeLabel.Parent = panel

-- Tombol kembali ke Basecamp (kanan bawah, di atas tombol lompat mobile)
local button = Instance.new("TextButton")
button.Name = "BasecampButton"
button.AnchorPoint = Vector2.new(1, 1)
button.Position = UDim2.new(1, -12, 1, -170)
button.Size = UDim2.fromOffset(150, 40)
button.BackgroundColor3 = Color3.fromRGB(110, 75, 40)
button.Text = "Turun ke Basecamp"
button.TextColor3 = Color3.new(1, 1, 1)
button.Font = Enum.Font.GothamBold
button.TextScaled = true
button.Parent = gui
corner(button, 8)
local pad = Instance.new("UIPadding")
pad.PaddingLeft = UDim.new(0, 8)
pad.PaddingRight = UDim.new(0, 8)
pad.Parent = button

button.Activated:Connect(function()
	basecampEvent:FireServer()
end)

-- Banner pengumuman (tengah atas)
local banner = Instance.new("TextLabel")
banner.Name = "Banner"
banner.AnchorPoint = Vector2.new(0.5, 0)
banner.Position = UDim2.new(0.5, 0, 0, 100)
banner.Size = UDim2.new(0.7, 0, 0, 50)
banner.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
banner.BackgroundTransparency = 1
banner.TextTransparency = 1
banner.TextColor3 = Config.COLORS.Checkpoint
banner.TextStrokeTransparency = 1
banner.Font = Enum.Font.GothamBlack
banner.TextScaled = true
banner.Parent = gui
corner(banner)
local bannerPad = Instance.new("UIPadding")
bannerPad.PaddingLeft = UDim.new(0, 12)
bannerPad.PaddingRight = UDim.new(0, 12)
bannerPad.Parent = banner

local queue = {}
local showing = false
local fadeInfo = TweenInfo.new(0.35)

local function showNext()
	if showing or #queue == 0 then
		return
	end
	showing = true
	banner.Text = table.remove(queue, 1)
	TweenService:Create(banner, fadeInfo, { TextTransparency = 0, BackgroundTransparency = 0.3 }):Play()
	task.delay(4, function()
		local tween = TweenService:Create(banner, fadeInfo, { TextTransparency = 1, BackgroundTransparency = 1 })
		tween:Play()
		tween.Completed:Wait()
		showing = false
		showNext()
	end)
end

announceEvent.OnClientEvent:Connect(function(message)
	table.insert(queue, message)
	showNext()
end)

-- Perbarui status tiap frame
RunService.Heartbeat:Connect(function()
	local checkpoint = player:GetAttribute("Checkpoint") or 0
	if checkpoint >= Config.STAGES then
		posLabel.Text = "Puncak tercapai!"
	else
		posLabel.Text = string.format("%s  →  %s", Config.checkpointName(checkpoint), Config.checkpointName(checkpoint + 1))
	end

	local text
	local lastTime = player:GetAttribute("LastTime")
	if checkpoint >= Config.STAGES and lastTime then
		text = "Waktu: " .. Config.formatTime(lastTime)
	else
		local start = player:GetAttribute("ClimbStart")
		text = "Waktu: " .. (start and Config.formatTime(workspace:GetServerTimeNow() - start) or "--:--")
	end
	local best = player:GetAttribute("BestTime")
	if best then
		text = text .. "   Rekor: " .. Config.formatTime(best)
	end
	timeLabel.Text = text
end)

require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'QuickPosePostProcessor'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = { :type => 'MIT' }
  s.author         = { 'guided_exercise' => '' }
  s.homepage       = 'https://github.com/quickpose/quickpose-ios-sdk'
  s.platforms      = { :ios => '14.0' }
  s.swift_version  = '5.7'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = 'ios/**/*.{h,m,mm,swift,hpp,cpp}'
end
